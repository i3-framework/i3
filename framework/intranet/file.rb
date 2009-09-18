#
# File: framework/intranet/file
#
# Extends the Ruby `File` class with helper methods.
#
# This file provides the <I3::File> class, which adds support for sending
# file metadata to intranet clients, including icon paths.  `I3::File` objects
# that are sent to clients have the following properties:
# 
#   name - the name of the file, without any path information
#   size - the size of the file in bytes (zero for folders)
#   modified_at - the time at which the file was last modified
#   is_folder - `true` if the object represents a folder
#   small_icon - the path to a 16x16 image that can be used for the file icon
#   large_icon - the path to a 32x32 image that can be used for the file icon
# 
# Icon paths are given from the intranet root, with a leading slash.
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
#   $Id: file.rb 84 2008-04-08 20:48:58Z nmellis $
#


#
# Module: I3
#
# Module containing class definitions and data shared by all
# intranet applications.
#
module I3
  
  #
  # Class: I3::File
  #
  # Extends the Ruby `File` class with useful methods for intranet web
  # service development.
  #
  class File < File
    include LoggingSupport

    I3_ICON_MAP_FILE = "#{I3::ROOT_PATH}/framework/resources/file-types.yml"
    I3_SMALL_ICON_PATH = "/common/client-web/img/file-types/%s-16.png"
    I3_LARGE_ICON_PATH = "/common/client-web/img/file-types/%s-32.png"
    I3_ICON_FOLDER = "folder"
    I3_ICON_DEFAULT = "generic"
    
    @@icon_map = nil     # Created the first time `icon_with_format` is called

    
    # ------------------------------------------------------------------------
    # Group: File attributes
    # ------------------------------------------------------------------------

    #
    # Method: name
    # 
    # Provides the name of the file, without any leading path information.
    # 
    def name
      @name = File.basename(self.path) if @name.nil?
      @name
    end #def
    
    #
    # Method: extension
    # 
    # Provides the extension for the file, e.g. "txt".
    # An empty string is returned if the file has no extension.
    # 
    # Returns:
    #   The extension string.
    # 
    def extension
      if @extension.nil?
        @extension = File.extname(self.path)
        @extension = @extension[1..-1] if @extension[0..0] == "."
      end #if
      @extension
    end #def

    #
    # Method: size
    # 
    # Provides the size of the file in bytes.
    # If the file object represents a folder, zero is returned.
    # 
    # Returns:
    #   The number of bytes in the file.
    # 
    def size
      return 0 if self.is_folder?
      return File.size(self.path)
    end #def
  
    #
    # Method: modified_at
    # 
    # Tells when the file was last modified.
    # 
    # Returns:
    #   The `Time` at which the file was modified.
    # 
    def modified_at
      self.mtime
    end #def
  
    #
    # Method: is_folder?
    # 
    # Tells whether the file object represents a directory.
    # 
    # Returns:
    #   `true` if the file path is a directory
    # 
    def is_folder?
      File.directory?(self.path)
    end #def
  
    #
    # Method: small_icon
    #
    # Provides the path to a 16x16 image file that can be used for display as
    # the file's icon, e.g. "/common/client-web/img/file-types/generic-16.png".
    #
    # Returns:
    #   The path string for the image.
    #
    def small_icon
      if @small_icon.nil?
        @small_icon = icon_with_format(I3_SMALL_ICON_PATH)
      end #if
      @small_icon
    end #def
  
    #
    # Method: large_icon
    #
    # Provides the path to a 32x32 image file that can be used for display as
    # the file's icon, e.g. "/common/client-web/img/file-types/generic-32.png".
    #
    # Returns:
    #   The path string for the image.
    #
    def large_icon
      if @large_icon.nil?
        @large_icon = icon_with_format(I3_LARGE_ICON_PATH)
      end #if
      @large_icon
    end #def


    # ------------------------------------------------------------------------
    # Group: File object conversion
    # ------------------------------------------------------------------------
  
    #
    # Method: to_hash
    #
    # Provides a hash containing selected file attributes that are of use
    # to intranet clients.
    #
    # Returns:
    #   The `Hash` representing the file object.
    #
    def to_hash
      { :name => self.name,
        :size => self.size,
        :modified_at => self.modified_at,
        :is_folder => self.is_folder?,
        :small_icon => self.small_icon,
        :large_icon => self.large_icon }
    end #def
  
    #
    # Method: to_json
    #
    # Encodes selected file attributes in JSON format for sending to the
    # client.
    # 
    # This uses the <to_hash> method to first convert the object to a `Hash`.
    # Subclasses can override <to_hash> to add properties to be encoded in
    # the JSON string.
    #
    # Returns:
    #   The JSON string representing the object.
    #
    def to_json(options = nil)
      self.to_hash.to_json(options)
    end #def


    # ------------------------------------------------------------------------
    # Group: Class methods
    # ------------------------------------------------------------------------
  
    def self.small_icon_for_extension(ext)
      icon_for_extension_with_format(ext, I3_SMALL_ICON_PATH)
    end #def
    
    def self.large_icon_for_extension(ext)
      icon_for_extension_with_format(ext, I3_LARGE_ICON_PATH)
    end #def

    def self.small_icon_for_folder
      I3_SMALL_ICON_PATH % I3_ICON_FOLDER
    end #def

    def self.large_icon_for_folder
      I3_LARGE_ICON_PATH % I3_ICON_FOLDER
    end #def


    # ------------------------------------------------------------------------
    # Private methods
    # ------------------------------------------------------------------------
  
    private
    
    #
    # Private Method: icon_with_format
    # 
    # Determines the icon to use, based on the file's extension,
    # and uses the given format to create a path.  If the icon
    # file does not exist, a generic icon is returned.
    # 
    # Parameters:
    #   path_format - the format string to use to create the path
    # 
    # Returns:
    #   The path string for the icon.
    # 
    def icon_with_format(path_format)
      return (path_format % I3_ICON_FOLDER) if self.is_folder?
      return I3::File.icon_for_extension_with_format(
          self.extension, path_format)
    end #def

    #
    # Private Class Method: icon_for_extension_with_format
    # 
    # Determines the icon to use based on the given extension and
    # uses the given format to create a path.  If the icon file
    # does not exist, a generic icon is returned.
    # 
    # Parameters:
    #   ext - the extension to use to determine the icon
    #   path_format - the format string to use to create the path
    # 
    # Returns:
    #   The path string for the icon.
    # 
    def self.icon_for_extension_with_format(ext, path_format)
      if @icon_map.nil?
        file_types = YAML.load(File.read(I3_ICON_MAP_FILE))
        @icon_map = {}
        file_types.each do |icon_name, extensions|
          extensions.each { |type_ext| @icon_map[type_ext] = icon_name }
        end #each
      end #if
      icon_name = @icon_map[ext] || I3_ICON_DEFAULT
      icon_path = path_format % icon_name
      if File.exist?(I3::ROOT_PATH + "/tools" + icon_path)
        return icon_path
      else
        log.warn 'Missing icon "%s" for file extension "%s".' %
                 [ icon_path, self.extension ]
        return path_format % I3_ICON_DEFAULT
      end #if
    end #def
  
  end #class

end #module