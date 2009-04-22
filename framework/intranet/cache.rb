#
# File: framework/intranet/cache
#
# Provides the <I3::Cache> class.
# 
# The cache class aids in reading data from and writing data to the
# `i3-local/files/cache` folder.  This folder contains copies of data
# that have been retrieved from some other data store (e.g. a database
# server or an LDAP server).  The data stored in the cache generally
# takes a potentially time-consuming query to generate, but doesn't
# usually change from request to request.  The query result can thus
# be stored for a period of time and returned when requested, and it
# will be refreshed when necessary.
#
# The cache is accessed using the `I3.cache` property.  Cached values
# can be anything that can be sent using `I3.server.send_object`,
# which includes base types like numbers and strings, as well as instances
# of <I3::SharedObject>.  `I3.cache` can be accessed using `Hash` notation,
# for example:
#
# (start example)
#   hero = I3::SharedObject.new
#   hero.name = "Henry Jones, Jr."
#   hero.alias = "Indiana"
#   I3.cache["hero"] = hero
# (end example)
#
# Each item in the cache is associated with a specific tool, so two different
# tools can use the same cached item name.  The tool is automatically
# determined when a CGI request is handled.  To use the cache in a script
# (i.e. when there is no CGI information to provide the tool), the
# <I3::Cache::get> and <I3::Cache::set> methods can be used:
#
# (start example)
#   hero = I3.cache.get("hero", "movie-tool")
# (end example)
#
# One advantage to cached objects is that the server can stream them
# directly to the client without any overhead, using `send_cached_object`:
#
# (start example)
#   I3.server.send_cached_object("hero")
# (end example)
#
# The cache can also store non-object data via the `read`, `write`, and
# `append` methods.  These methods take a block argument, to which they
# provide an `IO` argument that can be read from or written to.  For example:
#
# (start example)
#   I3.cache.write("page") do |output|
#     output.puts "<html><body>Hello!</body></html>"
#   end #write
#   I3.server.send_compressed do
#     I3.cache.read("page") { |input| puts input.read }
#   end #send_compressed
# (end example)
#
# Each cache key will map to a file on the filesystem.  It's possible to
# separate out the cache entries into directories using forward slashes ("/").
# In most cases, this will not be necessary, but services that cache many
# files may make use of it.  Example:
#
# (start example)
#   I3.cache["hardware/desktops"] = desktop_array
# (end example)
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
#   $Id: cache.rb 133 2008-11-26 23:12:27Z nmellis $
#

require "fileutils"
require "lockfile"

#
# Module: I3
#
# Module containing class definitions and data shared by all
# intranet applications.
#
module I3
  
  #
  # Constant: CACHE_PATH
  # Location of cached intranet data.
  #
  CACHE_PATH = I3::LOCAL_PATH + "/files/cache"

  #
  # Class: I3::Cache
  # Provides access to the intranet data cache.
  #
  class Cache

    #
    # Method: []
    #
    # Alias for <I3::Cache::get>.  The current tool is assumed.
    # If the intranet is not currently responding to a CGI request,
    # this will raise an exception; use <I3::Cache::get> in this case.
    #
    # Parameters:
    #   key - the key of the cached object to look up
    #
    # Returns:
    #   The cached object, or `nil` if the object could not be found.
    #
    # Raises:
    #   `ArgumentError` if no current tool could be determined
    #   (e.g. the <I3::Cache> class is being used in an interactive
    #   session or a non-intranet script).
    #   `IOError` if the `key` refers to a directory.
    #
    def [](key)
      self.get(key)
    end #def
    
    #
    # Method: []=
    #
    # Alias for <I3::Cache::set>.  The current tool is assumed.
    # If the intranet is not currently responding to a CGI request,
    # this will raise an exception; use <I3::Cache::set> in this case.
    #
    # Parameters:
    #   key - the key of the cached object to look up
    #   value - the object to cache, or `nil` to delete the key
    #
    # Raises:
    #   `ArgumentError` if no current tool could be determined
    #   (e.g. the <I3::Cache> class is being used in an interactive
    #   session or a non-intranet script).
    #   `IOError` if the `key` refers to a directory.
    #
    def []=(key, value)
      if value.nil?
        path = get_file_path(key, nil)  # To prevent removal of directories
        self.delete(key)
      else
        self.set(key, value)
      end #if
    end #def
    
    #
    # Method: get
    #
    # Retrieves an object from the cache.
    #
    # Parameters:
    #   key - the key of the cached object to look up
    #   tool - optional; the name of the tool that cached the object.
    #     Defaults to the tool handling the current request.
    #
    # Returns:
    #   The cached object, or `nil` if the object could not be found.
    #
    # Raises:
    #   `ArgumentError` if the `tool` argument was omitted and no
    #   current tool could be determined (e.g. the <I3::Cache> class
    #   is being used in an interactive session or a non-intranet script).
    #   `IOError` if the `key` refers to a directory.
    #
    def get(key, tool=nil)
      path = get_file_path(key, tool)
      return nil unless File.exist? path
      contents = "" # "--- "
      self.read(key, tool) { |io| contents += io.read }
      return SharedObject.convert_hashes(JSON.parse(contents))
    end #def
    
    #
    # Method: set
    #
    # Stores an object in the cache.  The object can be any type that is
    # supported by <I3::ServerApp::send_object>, including most standard
    # types (numbers, strings, etc.) and <I3::SharedObject> instances.
    #
    # Parameters:
    #   key - the key of the cached object to set
    #   value - the object to cache, or `nil` to delete the key
    #   tool - optional; the name of the tool that is caching the object.
    #     Defaults to the tool handling the current request.
    #
    # Raises:
    #   `ArgumentError` if the `tool` argument was omitted and no
    #   current tool could be determined (e.g. the <I3::Cache> class
    #   is being used in an interactive session or a non-intranet script).
    #   `IOError` if the `key` refers to a directory.
    #
    def set(key, value, tool=nil)
      path = get_file_path(key, tool)
      json = case
        when value.respond_to?(:to_json)
          value.to_json
        when value.respond_to?(:to_shared)
          value.to_shared.to_json
        else
          nil
      end #case
      if json.nil?
        raise ArgumentError, "The #{obj.class.name} object being cached " +
          "does not support the to_json or to_shared methods."
        return
      end #if
      self.write(key, tool) { |io| io.puts json }
    end #def
    
    #
    # Method: read
    #
    # Opens a cache file for reading.  A block must be given that
    # accepts an `IO` type argument.
    #
    # Parameters:
    #   key - the key of the cache file to read
    #   tool - optional; the name of the tool that cached the object.
    #     Defaults to the tool handling the current request.
    #
    # Raises:
    #   `IOError` if the `key` could not be found or refers to a directory.
    #   `ArgumentError` if the `tool` argument was omitted and no current
    #   tool could be determined (e.g. the <I3::Cache> class is being used
    #   in an interactive session or a non-intranet script).
    #
    def read(key, tool=nil)
      path = get_file_path(key, tool)
      unless File.exist? path
        raise IOError, "The cache entry '#{key}' could not be found."
      end #unless
      lock(path) { File.open(path, "r") { |file| yield file } }
      return true
    end #def
    
    #
    # Method: write
    #
    # Opens a cache file for writing.  A block must be given that
    # accepts an `IO` type argument.  This will overwrite any existing
    # cache files with the same name.
    #
    # Parameters:
    #   key - the key of the cache file to write to
    #   tool - optional; the name of the tool that cached the object.
    #     Defaults to the tool handling the current request.
    #
    # Raises:
    #   `ArgumentError` if the `tool` argument was omitted and no
    #   current tool could be determined (e.g. the <I3::Cache> class
    #   is being used in an interactive session or a non-intranet script).
    #   `IOError` if the `key` refers to a directory.
    #
    def write(key, tool=nil)
      path = get_file_path(key, tool)
      FileUtils.mkdir_p(File.dirname(path))
      lock(path) { File.open(path, "w") { |file| yield file } }
      return true
    end #def
    
    #
    # Method: append
    #
    # Opens a cache file for appending.  A block must be given that
    # accepts an `IO` type argument.
    #
    # Parameters:
    #   key - the key of the cache file to write to
    #   tool - optional; the name of the tool that cached the object.
    #     Defaults to the tool handling the current request.
    #
    # Raises:
    #   `ArgumentError` if the `tool` argument was omitted and no
    #   current tool could be determined (e.g. the <I3::Cache> class
    #   is being used in an interactive session or a non-intranet script).
    #   `IOError` if the `key` refers to a directory.
    #
    def append(key, tool=nil)
      path = get_file_path(key, tool)
      FileUtils.mkdir_p(File.dirname(path))
      lock(path) { File.open(path, "a") { |file| yield file } }
      return true
    end #def
    
    #
    # Method: delete
    #
    # Removes an object from the cache.  If the `key` refers to a directory,
    # the entire directory tree will be removed.
    #
    # Parameters:
    #   key - the key of the cached object to remove
    #   tool - optional; the name of the tool that cached the object.
    #     Defaults to the tool handling the current request.
    #
    # Returns:
    #   `true` if the object was deleted, `false` if it did not exist.
    #
    # Raises:
    #   `ArgumentError` if the `tool` argument was omitted and no
    #   current tool could be determined (e.g. the <I3::Cache> class
    #   is being used in an interactive session or a non-intranet script).
    #
    def delete(key, tool=nil)
      path = get_file_path(key, tool, false)
      return false unless File.exist? path
      lock(path) { FileUtils.rm_r(path) }
      return true
    end #def
    
    #
    # Method: exist?
    #
    # Determines if a cached object exists.
    #
    # Parameters:
    #   key - the key of the cached object to check for
    #   tool - optional; the name of the tool that cached the object.
    #     Defaults to the tool handling the current request.
    #
    # Returns:
    #   `true` if the object exists, `false` if it could not be found.
    #
    # Raises:
    #   `ArgumentError` if the `tool` argument was omitted and no
    #   current tool could be determined (e.g. the <I3::Cache> class
    #   is being used in an interactive session or a non-intranet script).
    #
    def exist?(key, tool=nil)
      path = get_file_path(key, tool, false)
      return File.exist?(path)
    end #def

    #
    # Method: directory?
    #
    # Determines if a key refers to a directory.
    #
    # Parameters:
    #   key - the key of the cached object to check for
    #   tool - optional; the name of the tool that cached the object.
    #     Defaults to the tool handling the current request.
    #
    # Returns:
    #   `true` if the `key` refers to a directory, `false` if it does not
    #   (i.e. it is a file or it could not be found).
    #
    # Raises:
    #   `ArgumentError` if the `tool` argument was omitted and no
    #   current tool could be determined (e.g. the <I3::Cache> class
    #   is being used in an interactive session or a non-intranet script).
    #
    def directory?(key, tool=nil)
      path = get_file_path(key, tool, false)
      return File.directory?(path)
    end #def
    
    #
    # Method: touch
    #
    # Updates the modification time of a cached object.  The object will
    # be created if it does not already exist.
    #
    # Parameters:
    #   key - the key of the cached object to update
    #   tool - optional; the name of the tool that cached the object.
    #     Defaults to the tool handling the current request.
    #
    # Returns:
    #   `true` if the file was created, `false` if it already exists.
    #
    # Raises:
    #   `ArgumentError` if the `tool` argument was omitted and no
    #   current tool could be determined (e.g. the <I3::Cache> class
    #   is being used in an interactive session or a non-intranet script).
    #   `IOError` if the `key` refers to a directory.
    #
    def touch(key, tool=nil)
      path = get_file_path(key, tool)
      was_created = (not File.exist? path)
      FileUtils.mkdir_p(File.dirname(path))
      lock(path) { FileUtils.touch path }
      return was_created
    end #def
    
    #
    # Method: get_info
    #
    # Returns a <I3::CacheInfo> object for the cached item.  This tells
    # the item's modification time and other details.
    #
    # Parameters:
    #   key - the key of the cached object retrieve information for
    #   tool - optional; the name of the tool that cached the object.
    #     Defaults to the tool handling the current request.
    #
    # Raises:
    #   `ArgumentError` if the `tool` argument was omitted and no
    #   current tool could be determined (e.g. the <I3::Cache> class
    #   is being used in an interactive session or a non-intranet script).
    #   `IOError` if the `key` refers to a directory.
    #
    def get_info(key, tool=nil)
      path = get_file_path(key, tool)
      return CacheInfo.new(path)
    end #def
    
    private

    #
    # Private Method: get_file_path
    #
    # Returns the full path for a `tool` and `key` combination.
    #
    # Parameters:
    #   key - the key to convert to a full path
    #   tool - the name of the tool that is requesting the path.
    #     Defaults to the tool handling the current request if `nil`.
    #   forbid_directories - optional; if set to `true` (the default),
    #     an `IOError` will be raised if the path refers to a directory.
    #
    # Raises:
    #   `ArgumentError` if the `tool` argument was `nil` and no
    #   current tool could be determined (e.g. the <I3::Cache> class
    #   is being used in an interactive session or a non-intranet script).
    #   `IOError` if the `key` refers to a directory and `forbid_directories`
    #   is set to `true`.
    #
    def get_file_path(key, tool, forbid_directories=true)
      # Provide a default tool if none is supplied.
      tool = I3.config.tools.current.dir if tool.nil?
      if tool.nil?
        raise ArgumentError,
          "No tool was specified and no default tool can be determined."
      end #if
      path = File.expand_path("#{CACHE_PATH}/#{tool}/#{key}")
      unless path.starts_with? CACHE_PATH
        # Someone tried to pass in a path that escapes from the
        # cache directory
        raise ArgumentError,
          "The given key '#{key}' cannot be used to cache an object."
      end #unless
      if forbid_directories and File.directory? path
        raise IOError, "The requested key '#{key}' refers to a directory " +
                       "rather than an individual cache entry."
      end #if
      return path
    end #def
  
    #
    # Private Method: lock
    #
    # Locks a file and executes the given block.
    #
    # Parameters:
    #   path - the path of the file to lock
    #
    def lock(path)
      path = path[0..-2] if path[-1..-1] == "/"
      Lockfile.new(path + ".lock") { yield }
    end #def
  
  end #class

  #
  # Class: I3::CacheInfo
  #
  # Provides information about an object in the cache.
  #
  class CacheInfo

    # Property: size
    # The size of the cached object in bytes.
    attr_reader :size
    
    # Property: created_at
    # The creation time/date of the cached object.
    attr_reader :created_at

    # Property: modified_at
    # The last modification time/date of the cached object.
    attr_reader :modified_at
    
    def initialize(path)
      @size = File.size(path)
      @created_at = File.ctime(path)
      @modified_at = File.mtime(path)
    end #def

  end #class


  # -------------------------------------------------------------------------
  # Section: I3 module extensions
  # -------------------------------------------------------------------------

  #
  # Property: I3.cache
  # The shared instance of the intranet cache.
  # See <I3::Cache> for available methods.
  #
  def self.cache
    @_cache = Cache.new if @_cache.nil?
    return @_cache
  end #def

end #module
