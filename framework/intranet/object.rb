#
# File: framework/intranet/object
#
# Defines the intranet shared object class.
#
# The <I3::SharedObject> class is an extension of the Ruby standard
# `OpenStruct` class that makes it easy to share objects between JavaScript
# and Ruby code.
#
# Like JavaScript objects, <I3::SharedObject> instances generate their
# properties on-the-fly as they are accessed.  Properties can be accessed
# using either object notation (`object.property`) or hash notation
# (`object["property"]`).
#
# <I3::SharedObject> is particularly useful as a base class.  Subclasses
# can define their own methods and work pretty much like any other object,
# and instances of them will be automatically serialized when sent to
# the client via `I3.server.send_object`.  Note that only properties that
# have been defined using object notation or hash notation will be sent to
# the client.  Methods will not be sent, including methods that have been
# generated using Ruby's "attribute" helpers, such as `attr_accessor`.
#
# Example:
#
# (start example)
#   class Fortress < I3::SharedObject
#
#     def initialize(name, realm)
#       super()
#       self.name = name
#       self.realm = realm
#       self.battle_cry = 
#         "People of #{self.realm}, we must defend #{self.name}!"
#     end #def
#
#     def rally_troops
#       puts self.battle_cry
#     end #def
#
#   end #class
#
#   hdeep = Fortress.new("Helm's Deep", "Rohan")
#   hdeep.rally_troops
# (end example)
#
# Note the call to `super()` at the top of the `initialize` method; all
# subclasses of `SharedObject` must make this call if overriding the
# `initialize` method.
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
#   $Id: object.rb 2 2007-12-06 00:18:23Z melfstrand $
#

require "ostruct"
require "yaml"

#
# Module: I3
#
# Module containing class definitions and data shared by all
# intranet applications.
#
module I3
  
  #
  # Class: I3::SharedObject
  #
  # Base class for objects that can be shared between the client and server.
  # It extends the Ruby `OpenStruct` class with the `Enumerable`, <to_json>,
  # <to_yaml>, and <to_hash> methods.
  #
  class SharedObject < OpenStruct
    include Enumerable
    
    #
    # Method: []
    #
    # Returns a property.
    #
    # Parameters:
    #   k - the key of the property to return
    #
    def [](k)
      self.send(k)
    end #def
    
    #
    # Method: []=
    #
    # Sets a property.
    #
    # Parameters:
    #   k - the key of the property to set
    #   v - the new value of the property
    #
    def []=(k, v)
      self.send(k.to_s + "=", v)
    end #def
    
    #
    # Method: each
    #
    # Calls a block once for each property of the shared object, passing
    # the key and value to the block as a two-element array.  Because of
    # the semantics of block parameters, these elements will be split out
    # if the block has two formal parameters.
    #
    # Example:
    # (start example)
    #   obj = I3::SharedObject.new
    #   obj.first = 100
    #   obj.second = 200
    #   obj.each { |key, value| puts "#{key} is #{value}" }
    # (end example)
    #
    def each
      self.to_hash.each { |i| yield i }
    end #def
    
    #
    # Method: to_hash
    #
    # Returns a `Hash` containing a key/value pair for each property in
    # the shared object.
    #
    def to_hash
      @table.inject(Hash.new) { |h, arr| k, v = arr; h[k.id2name] = v; h }
    end #def

    #
    # Method: to_json
    #
    # Encodes the shared object in JSON format for sending to the client.
    #
    # Returns:
    #   The JSON string representing the object.
    #
    def to_json
      self.to_hash.to_json
    end #def
    
    #
    # Method: to_yaml
    #
    # Encodes the shared object as a `Hash` in YAML format.
    #
    # Parameters:
    #   opts - optional; additional options to pass to the YAML emitter
    #
    # Returns:
    #   The YAML string representing the object.
    #
    def to_yaml(*opts)
      self.to_hash.to_yaml(*opts)
    end #def

    #
    # Class Method: convert_hashes
    #
    # Converts all `Hash` objects in an object graph into <I3::SharedObject>
    # instances.  If the given object is not a container (that is, a `Hash`
    # or an `Array`), it is returned without modification.
    #
    # Example:
    # (start example)
    #   obj = I3::SharedObject.convert_hashes([
    #     { "name" => "Anakin", "profile" => "Wears a suit" },
    #     { "name" => "Palpatine", "profile" => "Plays with electricity" },
    #     { "name" => "Luke", "profile" => "Loves his sister" }
    #   ])
    #   puts obj[1].profile    # Outputs "Plays with electricity"
    # (end example)
    #
    # Parameters:
    #   obj - the object to convert
    #
    # Returns:
    #   The object, with all contained `Hash` instances converted
    #   to <I3::SharedObject> instances (including the object itself
    #   if applicable).
    #
    def self.convert_hashes(obj)
      case obj
        when Hash
          return obj.inject(SharedObject.new) do |new_obj, kv|
            new_obj[kv[0]] = convert_hashes(kv[1])
            new_obj
          end #inject
        when Array
          return obj.collect { |item| convert_hashes(item) }
        else
          return obj
      end #case
    end #def

  end #class

end #module
