#
# File: framework/intranet/directory
# 
# Contains the base class for directory service providers and the
# <I3.directory> object used to access directory service data.
# 
# Credits:
# 
#   Written by Marshall Elfstrand (marshall@vengefulcow.com) and
#              Nathan Mellis (nathan@mellis.us).
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
#   $Id: directory.rb 42 2008-01-07 16:57:28Z nmellis $
#

#
# Module: I3
#
# Module containing class definitions and data shared by all
# intranet applications.
#
module I3

  #
  # Class: I3::ProviderBase
  # 
  # Base class for all directory service providers used by the intranet.
  # 
  class ProviderBase

    PROVIDER_PREFIX = "providers/"
    
    cattr_accessor :last_provider_loaded
    attr_accessor :host, :port, :username, :password, :settings

    #
    # Class Method: inherited
    #
    # Automatically called by Ruby when a subclass of <I3::ProviderBase> is
    # defined.  This sets the `last_provider_loaded` class attribute, which
    # the framework checks after requiring the file so that it knows which
    # provider class to instantiate.
    #
    def self.inherited(subclass)
      self.last_provider_loaded = subclass
    end #def

    #
    # Method: connect
    # 
    # Connects to the directory service.  This is called automatically by
    # the framework when the directory service is first accessed.
    # 
    # The base implementation of this method does nothing.  Providers may
    # override this method to perform their own connection routine.
    # 
    def connect
    end #def

    #
    # Method: find_all_groups
    #
    # Returns the list of group distinguished names (DNs) in the directory
    # service.  Providers must override this method.
    # 
    # Returns:
    #   An `Array` of DN strings, each of which can be used to set group
    #   permissions.
    #
    def find_all_groups
      raise "Required method not implemented in #{self.class.name}: " +
            "find_all_groups"
    end

    #
    # Method: find_all_people
    #
    # Returns a list of all the people in the directory service that are in the search paths.
    # Providers must override this method.
    # 
    # Returns:
    #   An `Array` of UUID strings, each of which can be passed to <read_person> to obtain data 
    #   about a person in the directory.
    #
    def find_all_people
      raise "Required method not implemented in #{self.class.name}: " +
            "find_all_people"
    end #find_all_people

    #
    # Method: find_people
    # 
    # Returns the list of person UUIDs in the directory service that match
    # a particular search value.  Providers must override this method.
    # 
    # Parameters:
    #   search_field - the field symbol to search on (e.g. `:email`)
    #   value - the value to search for (e.g. "user@host.com")
    #   limit - optional; maximum number of entries to return
    # 
    # Returns:
    #   An `Array` of UUID strings, each of which can be passed to
    #   <read_person> to obtain data about a person in the directory.
    # 
    def find_people(search_field, value, limit=nil)
      raise "Required method not implemented in #{self.class.name}: " +
            "find_people"
    end

    #
    # Method: read_person
    #
    # Reads the data for a person from the directory.
    # Providers must override this method.
    #
    # Parameters:
    #   uuid - description
    #
    # Returns:
    #   An <I3::SharedObject> containing the data fields for the person
    #   obtained from the directory service.
    # 
    def read_person(uuid)
      raise "Required method not implemented in #{self.class.name}: " +
            "read_person"
    end

    #
    # Method: write_person
    #
    # Writes the data for a person to the directory.
    # Providers must override this method.
    #
    # Parameters:
    #   data - An <I3::SharedObject> containing the data fields to be
    #     written to the directory.  The data must include a `uuid`
    #     for lookup.  Any fields not included in the shared object
    #     will not be modified in the directory.
    #
    def write_person(data)
      raise "Required method not implemented in #{self.class.name}: " +
            "write_person"
    end

    #
    # Method: method_missing
    #
    # Called when a message is sent to the provider.  If the message
    # begins with "find_person_by", the provider's `find_people` method
    # will be called, passing in the search field specified in the message.
    #
    # Parameters:
    #   method_name - the name of the method that was called
    #   args - the arguments that were passed to the method
    #
    def method_missing(method_name, *args)
      method_name = method_name.to_s
      if method_name.starts_with?("find_person_by_")
        args << 1  # Limit results to 1 record
        return self.find_people(method_name[15..-1].to_sym, *args).to_a[0]
      else
        raise NoMethodError,
          'The directory service provider does not support the method "%s".' %
          method_name.to_s
      end #if
    end

    #
    # Class Method: load_provider
    # 
    # Loads a provider class and provides it with basic login information.
    # The `info` parameter is expected to have `:provider`, `:host`,
    # `:username`, `:password`, and `:settings` parameters.  An additional
    # `:port` parameter may be provided if the directory service provider
    # needs and supports non-standard ports.
    # 
    # Parameters:
    #   info - a `Hash` describing a directory service provider
    # 
    # Returns:
    #   An initialized subclass of <I3::ProviderBase>.
    # 
    def self.load_provider(info)
      provider_name = info[:provider]
      @_provider_classes = Hash.new if @_provider_classes.nil?
      unless @_provider_classes.has_key? provider_name
        require PROVIDER_PREFIX + provider_name
        @_provider_classes[provider_name] = ProviderBase.last_provider_loaded
      end #unless
      provider = @_provider_classes[provider_name].new
      provider.host = info[:host]
      provider.port = info[:port] unless info[:port].to_s.empty?
      provider.username = info[:username]
      provider.password = info[:password]
      provider.settings = info[:settings]
      return provider
    end #def

  end #class


  # -------------------------------------------------------------------------
  # Section: I3 module extensions
  # -------------------------------------------------------------------------

  #
  # Property: I3.directory
  # The shared instance of the intranet directory service provider.
  #
  def self.directory
    if @_directory.nil?
      @_directory = ProviderBase.load_provider(I3.config.directory_settings)
      @_directory.connect
    end #if
    return @_directory
  end #def

end #module
