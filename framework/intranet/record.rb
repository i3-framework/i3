#
# File: framework/intranet/record
#
# Provides Active Record support for the intranet.  This extends the Rails
# Active Record framework to support the functionality needed by the
# intranet, and provides the <I3::Record> class from which all intranet
# data models should inherit.
#
# Credits:
# 
#   Written by Marshall Elfstrand (marshall@vengefulcow.com).
# 
# Copyright / License:
# 
#   Copyright 2009 Mission Aviation Fellowship
# 
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
# 
#     http://www.apache.org/licenses/LICENSE-2.0
# 
#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.
#
# Version:
#   $Id: record.rb 2 2007-12-06 00:18:23Z melfstrand $
#

require "active_record"


#
# Class (Hidden): Class
#
# Extends the built-in class object with class and instance accessors
# for class attributes, just like the native `attr_accessor` for instance
# attributes.  This is a variant of Rails' `cattr_accessor` method, except
# the methods generated here can be overridden by subclasses without
# affecting the main class.
#
# This is slightly convoluted, so it's worth explaining.  Suppose we have
# a base class called "Animal" that has an attribute accessor defined
# like this:
#
# >  overridable_cattr_accessor :sound
#
# This line of code will generate five methods in the "Animal" class:
#
# (start example)
#   # Class-level reader for the value.
#   # This will be re-written by self.sound=().
#   def self.sound
#     nil
#   end #def
#
#   # Class-level writer for the value.
#   # This will re-write the self.sound method.
#   def self.sound=(value=nil, &block)
#     define_attr_method :sound, value, &block
#   end #def
#
#   # Another way of calling the self.sound=() method.
#   def self.set_sound(value=nil, &block)
#     define_attr_method :sound, value, &block
#   end #def
#
#   # Provides access to the reader from inside instances.
#   def sound
#     self.class.sound
#   end #def
#
#   # Provides access to the writer from inside instances.
#   def sound=(value=nil, &block)
#     self.class.set_sound(value, &block)
#   end #def
# (end example)
#
# Then let's suppose we have a subclass called "Dog" that inherits from
# "Animal".  It would have the following line:
#
# >   set_sound "Woof!"
#
# This calls the `self.set_sound` method, which in turn _replaces_ the
# existing `self.sound` method in the "Dog" class with the following:
#
# (start example)
#   def self.sound
#     "Woof!"
#   end #def
# (end example)
#
# So now any methods in the "Dog" class will get "Woof!" when they call
# the `sound` method, but the original "Animal" base class will still be
# returning `nil`.  We could then create all sorts of subclasses for "Dog",
# like "Spaniel", "Retriever", etc., and they would inherit the `sound`
# method from "Dog".  But we could also override it in specific cases:
# we could have a "WeinerDog" subclass that calls `set_sound "Yip!"`,
# and that would only affect "WeinerDog" and its subclasses.
#
# This is how `I3::Record` manages things like database names, table name
# prefixes, and so on.  You can create a base class that sets the database
# name, and all classes that inherit from it will get that name.
#
class Class

  def overridable_cattr_accessor(*syms)
    syms.flatten.each do |sym|
      class_eval(<<-EOS, __FILE__, __LINE__)
        def self.#{sym}
          nil
        end #def
        def #{sym}
          self.class.#{sym}
        end #def
        def self.#{sym}=(value=nil, &block)
          define_attr_method :#{sym}, value, &block
        end #def
        def self.set_#{sym}(value=nil, &block)
          define_attr_method :#{sym}, value, &block
        end #def
        def #{sym}=(value=nil, &block)
          self.class.set_#{sym}(value, &block)
        end #def
      EOS
    end #each
  end #def

  # This is a clone of Active Record's `define_attr_method` so that
  # we can use it outside of record objects.  Active Record will
  # override it with its own, so we're not breaking anything.
  def define_attr_method(name, value=nil, &block)
    sing = class << self; self; end
    sing.send :alias_method, "original_#{name}", name
    if block_given?
      sing.send :define_method, name, &block
    else
      sing.class_eval "def #{name}; #{value.to_s.inspect}; end"
    end
  end

end #class


#
# Module: I3
#
# Module containing class definitions and data shared by all
# intranet applications.
#
module I3
  
  #
  # Class:  I3::Record
  #
  # The base class for all intranet data models.  This extends and fixes
  # the Rails `ActiveRecord::Base` class so that it can better support
  # multiple databases over a single connection.
  #
  class Record < ActiveRecord::Base
    include LoggingSupport

    DISABLE_INHERITANCE = "__no_inheritance__"

    class << self  # Class methods

      #
      # Class Method (Hidden): original_connection
      #
      # Saves the original `connection` method (defined in
      # `ActiveRecord::Base`) to call from the replacement
      # `connection` method.
      #
      alias_method :original_connection, :connection
    
      #
      # Class Method (Hidden): connection
      #
      # Wraps the Active Record `connection` method to verify the
      # connection before returning it.  This works around timeout
      # issues where the database server disconnects and Active
      # Record doesn't pick up on it.
      #
      def connection
        # Verify the connection if it's been over an hour
        # since it was last verified.
        self.original_connection.verify!(3600)
        self.original_connection
      end #def

      #
      # Class Method (Hidden): original_undecorated_table_name
      #
      # Saves the original `calculate` method (defined in
      # `ActiveRecord::Calculations`) to call from the replacement
      # `calculate` method.
      #
      alias_method :original_calculate, :calculate
    
      #
      # Class Method (Hidden): calculate
      #
      # Wraps the Active Record `calculate` method to set
      # `ActiveRecord::Base.connection` to the connection
      # being used by the record.
      # 
      # This is to work around a bug in Active Record, which
      # stupidly checks the connection on `Base` for functionality,
      # when in fact a subclass's connection might have completely
      # different functionality.
      #
      def calculate(operation, column_name, options = {})
        base = ActiveRecord::Base
        old_connection = base.connected? ? base.connection : nil
        base.connection = self.connection
        result = original_calculate(operation, column_name, options)
        if old_connection.nil? then base.remove_connection
        else base.connection = old_connection
        end #if
        result
      end #def

      #
      # Class Method (Hidden): original_undecorated_table_name
      #
      # Saves the original `undecorated_table_name` method (defined
      # in `ActiveRecord::Base`) to call when `nil` is passed to
      # `set_undecorated_table_name`.
      #
      alias_method :original_undecorated_table_name, :undecorated_table_name

      #
      # Class Method (Hidden): set_undecorated_table_name
      #
      # Sets the base table name to use to the given value, or (if the value
      # is `nil` or `false`) to the value returned by the given block.
      #
      # Calling `set_table_name` overrides the entire table name, including
      # the database prefix and table name prefix/suffix.  Sometimes it's
      # useful to just override the base part of the name, and still allow
      # the rest of the rules to apply.  This provides that functionality.
      #
      # The `undecorated_table_name` method is re-written in much the same
      # way as `overridable_cattr_accessor` would write it, but if `nil`
      # is given as the `new_table_name` argument, the method that is
      # generated will simply call the original `undecorated_table_name`
      # method from Rails, which guesses the name.
      #
      def set_undecorated_table_name(new_table_name=nil)
        value = table_name ? "'#{new_table_name}'" :
                             "original_undecorated_table_name(class_name)"
        class_eval <<-EOS
          def self.undecorated_table_name(class_name=self.class.name)
            #{value}
          end #def
        EOS
      end #def
      alias :undecorated_table_name= :set_undecorated_table_name

      #
      # Class Method (Hidden): set_pluralize_table_names
      #
      # Sets the `pluralize_table_names` value for the class.
      # This overrides the `set_pluralize_table_names` method in
      # `ActiveRecord::Base` to make it subclass-specific.
      #
      def set_pluralize_table_names(value)
        # We can't construct this one with overridable_cattr_accessor
        # since it takes booleans and the Active Record implementation of
        # define_attr_method doesn't handle boolean values properly.
        class_eval <<-EOS
          def self.pluralize_table_names; #{value}; end
          def pluralize_table_names; #{value}; end
        EOS
      end #def
      
      #
      # Class Method (Hidden): pluralize_table_names=
      #
      # Alias for <set_pluralize_table_names>.
      #
      def pluralize_table_names=(value)
        self.set_pluralize_table_names(value)
      end #def

      #
      # Class Method (Hidden): table_name
      #
      # Overrides the Active Record `table_name` implementation to add
      # multiple database support.  Returns a guessed table name based on
      # the class name and any `db_name`, `table_name_prefix`, and/or
      # `table_name_suffix` settings.
      #
      # If the `inheritance_column` value has been set, the table name
      # will be based on the name of the base class that inherits directly
      # from `I3::Record`.
      #
      def table_name
        db_prefix = db_name ? db_name + "." : ""
        if inheritance_column == DISABLE_INHERITANCE
          return db_prefix + table_name_prefix +
                 undecorated_table_name(self) +
                 table_name_suffix
        else
          return db_prefix + table_name_prefix +
                 undecorated_table_name(base_class.name) +
                 table_name_suffix
        end #if
      end #def
  
      #
      # Class Method (Hidden): base_class
      #
      # Returns the name of the class descending directly from `I3::Record`
      # in the inheritance hierarchy.  This overrides the `base_class`
      # method found in `ActiveRecord::Base`.  It is used in <table_name>
      # as part of the table name guessing system.
      #
      def base_class
        class_of_i3_record_descendant(self)
      end #def
  
      #
      # Class Method (Hidden): class_name_of_i3_descendant
      #
      # Returns the name of the class descending directly from `I3::Record`
      # in the inheritance hierarchy.  This is called by <base_class> to
      # work up the inheritance tree.
      #
      def class_of_i3_record_descendant(klass)
        if klass.superclass == I3::Record || klass.superclass.abstract_class?
          klass
        elsif klass.superclass.nil?
          raise ActiveRecordError,
            "#{name} doesn't belong in a hierarchy descending from I3::Record"
        else
          class_of_i3_record_descendant(klass.superclass)
        end #if
      end #def

      #
      # Class Method (Hidden): compute_type
      #
      # This method works around a bug in Rails 1.1 that causes Active Record
      # to put the wrong module name in front of types when constructing
      # relationships between records in different modules.  The problem is
      # in `ActiveRecord::Base.compute_type`, which looks like this in
      # Rails 1.1:
      #
      # (start example)
      # def compute_type(type_name)
      #   modularized_name = type_name_with_module(type_name)
      #   begin
      #     instance_eval(modularized_name)
      #   rescue NameError => e
      #     STDERR.puts e.to_s
      #     first_module = modularized_name.split("::").first
      #     raise unless e.to_s.include? first_module
      #     instance_eval(type_name)
      #   end
      # end
      # (end example)
      #
      # The `type_name_with_module` method prepends the current module
      # name, so if we're referencing the `BulletinBoard::Topic` data
      # model from the `Home::HomePage` data model, it will come up with
      # "Home::BulletinBoard::Topic" as the class name.  This is fine,
      # as it rescues the error, but the error handling code has the line:
      #
      # >  raise unless e.to_s.include? first_module
      #
      # This will check to see if the error text contains the word "Home"
      # in our example, and only continue if it does.  But it never will:
      # the error is not that the "Home" module doesn't exist, it's that
      # "BulletinBoard" doesn't exist _inside_ that module.  The error that
      # is raised is:
      #
      # >  uninitialized constant BulletinBoard
      #
      # So `compute_type` will never work for modularized names.  This
      # replacement method overrides that to remove the whole prepending
      # the module bit, and simply evaluates the type as-is.
      #
      # Hopefully this can be removed for a future release of Rails.
      #
      def compute_type(type_name)
        modularized_name = type_name_with_module(type_name)
        begin
          instance_eval(modularized_name)
        rescue NameError => e
          instance_eval(type_name)
        end
      end

    end #class methods

    #
    # Method (Hidden): pluralize_table_names=
    #
    # Adds the ability to call `self.pluralize_table_names=` from within
    # a class instance.
    #
    def pluralize_table_names=(value)
      self.class.set_pluralize_table_names(value)
    end #def

    #
    # Method: to_json
    #
    # Encodes the record's `attributes` in JSON format for sending to
    # the client.
    #
    # Returns:
    #   The JSON string representing the record.
    #
    def to_json(options = nil)
      self.to_shared.to_json(options)
    end #def

    #
    # Method: to_shared
    #
    # Returns this record's `attributes` as a new <I3::SharedObject>.
    #
    # Normally only attributes one level deep are converted; relationships
    # are not followed.  For example, if a `Person` object has an array
    # of `addresses` associated with it, the array will not be included
    # in the results.  You can, however, include related objects using
    # the `:include` option:
    #
    # >  person.to_shared(:include=>:addresses)
    #
    # The `:include` option works with symbols, strings, and arrays of
    # symbols or strings.  Multiple levels of the hierarchy can be
    # separated by dots.  For example, if each `Person` had an
    # `address_history`, where each item in the history contained a
    # start date, end date, and a related `address` record, you could
    # bring back the entire history with addresses like this:
    #
    # >  person.to_shared(:include=>["address", "address_history.address"])
    #
    # All fields in the record are normally included in the output,
    # including ID fields.  Frequently you will not want to send
    # database IDs to the client, using a more human-readable permalink
    # instead.  The `to_shared` method supports a `:strip_id` option
    # that, when set to `true`, removes all fields ending in `_id` from
    # the shared object:
    #
    # >  person.to_shared(:strip_id=>true)
    #
    # Parameters:
    #   options - optional; `Hash` that may contain `:include`
    #     and/or `:strip_id` options
    #
    def to_shared(options=nil)

      # Convert the basic record to a shared object.
      obj = SharedObject.new
      self.attributes.keys.each do |field_name|
        obj[field_name] = self.send(field_name)
      end #each

      # Check for options.
      if options.is_a? Hash
        options.symbolize_keys!
        strip_id = (options[:strip_id] ? true : false)

        # Handle :include option
        if options.has_key? :include
          # Make an array of strings if we don't already have one.
          fields = options[:include]
          if fields.is_a? Array
            fields = fields.collect { |field| field.to_s }
          else
            fields = [ fields.to_s ]
          end #if
          # Process each item in the list.
          fields.each do |field|
            opts = { :strip_id => strip_id }
            # Create an include list for dot-separated items.
            field_parts = field.split(".")
            if field_parts.size > 1
              opts[:include] = field_parts[1..-1].join(".")
            end #if
            # Get the included field.
            val = self.send(field_parts[0])
            if val.is_a? Array
              # Convert each item in the array to a shared object if possible.
              missing_shared = 0
              obj[field_parts[0]] = val.inject([]) do |arr, val_item|
                # Make sure the item can either become a shared object or
                # supports JSON serialization directly.
                if val_item.respond_to? :to_shared
                  arr << val_item.to_shared(opts)
                elsif val_item.respond_to? :to_json
                  arr << val_item
                else
                  missing_shared += 1
                end #if
                arr
              end #inject
              if missing_shared > 0
                log.warn "#{missing_shared} items in the " +
                  "'#{field_parts[0]}' array could not be converted " +
                  "to shared objects."
              end #if
            else
              # Make sure the item can either become a shared object or
              # supports JSON serialization directly.
              if val.respond_to? :to_shared
                obj[field_parts[0]] = val.to_shared(opts)
              elsif val.respond_to? :to_json
                obj[field_parts[0]] = val
              else
                log.warn "The '#{field_parts[0]}' field could not be " +
                  "converted to a shared object."
              end #if
            end #if
          end #each
        end #if
        
        # Handle :strip_id option
        if strip_id
          doomed_fields = obj.find_all do |k, v|
            k == "id" or k.ends_with?("_id")
          end #find_all
          doomed_fields.each { |k, v| obj.delete_field(k) }
        end #if

      end #if
      return obj
    end #def

    #
    # Class Property: db_name
    #
    # The name of database that contains the table used by the class.
    # If set, this will be prepended to the name of each subclass's table
    # unless `table_name` is explicitly set in the subclass.
    overridable_cattr_accessor :db_name
    
    # ------------------------------------------------------------------------

    overridable_cattr_accessor :table_name_prefix   # Now subclass-specific
    overridable_cattr_accessor :table_name_suffix   # Now subclass-specific
    overridable_cattr_accessor :inheritance_column  # Now subclass-specific

    set_table_name_prefix ""                    # Restore default
    set_table_name_suffix ""                    # Restore default
    set_pluralize_table_names true              # Restore default
    set_inheritance_column DISABLE_INHERITANCE  # Disable table inheritance
    
    self.default_timezone = :utc         # Use GMT by default

  end #class
  
end #module
