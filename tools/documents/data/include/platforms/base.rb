#
# File: documents/data/include/platforms/base
# 
# Contains the base class for platform-specific document code.
#
# Credits:
# 
#   Written by
#     Marshall Elfstrand (marshall@vengefulcow.com) and
#     Nathan Mellis (nathan@mellis.us).
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
#   $Id: base.rb 66 2008-03-17 19:16:01Z nmellis $
#

#
# Module: Documents
#
# Contains classes and data for the Documents tool.
# 
module Documents

  #
  # Class: Documents::DocumentPlatformBase
  # 
  # Base class for platform-specific document code.  Platforms that
  # provide support for searching/descriptions/metadata should inherit
  # from this class and implement the appropriate methods.
  # 
  # This class is used as the `DocumentPlatform` when no platform-specific
  # class is available.
  #
  class DocumentPlatformBase
  
    #
    # Class Method: searchable?
    # 
    # Returns `true` if the `search` method is available on this platform.
    #
    def self.searchable?
      false
    end #def

    #
    # Class Method: has_metadata?
    # 
    # Returns `true` if the `metadata` method is available on this platform.
    #
    def self.has_metadata?
      false
    end #def

    #
    # Class Method: has_description?
    # 
    # Returns `true` if the `description` and `set_description` methods are
    # available on this platform.
    #
    def self.has_description?
      false
    end #def
    
    #
    # Class Method: supports_permissions?
    #
    # Returns `true` if the platform supports permission checking on files  
    # before they are returned
    #
    def self.supports_permissions?
      false
    end #self.supports_permissions?

    #
    # Class Method: default_document_root
    # 
    # Returns the full path to the folder to use for shared documents
    # if no path has been specified in `server.yml`.
    # 
    def self.default_document_root
      I3::LOCAL_PATH + "/files/documents-root"
    end #def

    #
    # Class Method: make_link_for_file
    # 
    # Creates a temporary directory containing a link to the given
    # `source_file`.  The temporary directory will have a unique,
    # hard-to-guess name (platform-dependent, but usually a UUID).
    # 
    # Parameters:
    #   src_file - the full path of the file to be linked
    #   dest_dir - the full path of the directory in which the temporary
    #     directory and its contained link will be created
    # 
    # Returns:
    #   The full path of the newly created link.
    # 
    def self.make_link_for_file(src_file, dest_dir)
      file_name = File.basename(src_file)
      still_need_unique_name = true
      while still_need_unique_name
        # UUID-generation code is platform-specific.
        # Here we simply use the current time and prepend a random value.
        random_digits = rand(65536).to_s(16).rjust(4, "0")
        time_digits = Time.now.to_i.to_s(16).rjust(12, "0")
        unique_name = random_digits      + "-" + 
                      time_digits[0...4] + "-" +
                      time_digits[4...8] + "-" +
                      time_digits[8...12]
        unless File.directory?(dest_dir + "/" + unique_name)
          FileUtils.mkdir_p("#{dest_dir}/#{unique_name}")
          still_need_unique_name = false
        end #unless
      end #while
      link_path = "#{dest_dir}/#{unique_name}/#{file_name}"
      FileUtils.ln_s(src_file, link_path)
      link_path
    end #def

    #
    # Class Method: save_temp_file
    #
    # Saves a file to a temporary location.  It will generate a unique name for the file and 
    # save it to the location specified by `dest_dir`.  It will then return the unique name that 
    # the file was saved under.
    #
    # Parameters:
    #   src_file - the file to save
    #   dest_dir - the full directory path to save the temporary file in
    #
    def self.save_temp_file(src_file, dest_dir)
      FileUtils.mkdir_p(dest_dir) unless File.exists?(dest_dir)
      still_need_unique_name = true
      while still_need_unique_name
        # UUID-generation code is platform-specific.
        # Here we simply use the current time and prepend a random value.
        random_digits = rand(65536).to_s(16).rjust(4, "0")
        time_digits = Time.now.to_i.to_s(16).rjust(12, "0")
        unique_name = random_digits      + "-" + 
                      time_digits[0...4] + "-" +
                      time_digits[4...8] + "-" +
                      time_digits[8...12]
        still_need_unique_name = false unless File.exists?(File.join(dest_dir, unique_name))
      end #while
      File.open(File.join(dest_dir, unique_name), "w") { |io| io << src_file.read }
      unique_name
    end #self.save_temp_file
    
    #
    # Class Method: search
    # 
    # Performs a filesystem query using the given string (e.g. "Jabber").
    #
    # When specifying additional query parameters, the expected format is
    # 'Key comparator value', where Key is one of the available metadata
    # attribute keys; comparator is one of "==", "!=", ">", ">=", "<", or
    # ">="; and value is a string (in double quotes), a number, or a
    # date/time using the special "$time" syntax, described below.
    # The asterisk (*) can be used as a wildcard in string values.
    #
    # A list of supported metadata attributes for the platform can be obtained
    # by calling metadata_keys, which will return a hash of the keys and their
    # descriptions.
    #
    # The $time syntax is used to provide flexible date/time values.
    # There are several $time values supported:
    #
    #   $time.now                 the current date and time
    #   $time.today               the current date
    #   $time.yesterday           yesterday's date
    #   $time.this_week           the current week
    #   $time.this_month          the current month
    #   $time.this_year           the current year
    #   $time.now(NUMBER)         date and time by adding seconds (+/-) to now
    #   $time.today(NUMBER)       date by adding days (+/-) to current day
    #   $time.this_week(NUMBER)   date by adding weeks (+/-) to current week
    #   $time.this_month(NUMBER)  date by adding months (+/-) to current month
    #   $time.this_year(NUMBER)   date by adding years (+/-) to current year
    #   $time.iso(ISO-8601-STR)   date by parsing the ISO 8601 formatted date
    #
    # Examples:
    # (start example)
    #   search(DocumentFile::DOC_FILE_PATH, "policy",
    #          [ 'Modified > $time.this_month' ])
    #   search(DocumentFile::DOC_FILE_PATH, "jpg",
    #          [ 'Width == 640', 'Height == 480' ])
    #   search(DocumentFile::DOC_FILE_PATH, "IT",
    #          [ 'Kind == "*Word*"', 'Author == "*King*"' ])
    # (end example)
    #
    # Parameters:
    #   root - the path to search
    #   query - the word(s) to search for
    #   account - the <I3::Account> to search as
    #   params - optional; an array of additional queries to perform
    #     to refine the result set
    # 
    # Returns:
    #   An array of strings, each string being the full local path to a file.
    #   If no files are found, an empty array is returned.  If searching is
    #   not supported on this platform, `nil` is returned.
    #   
    def self.search(root, query, account, params=[])
      nil
    end

    #
    # Class Method: metadata
    # 
    # Provides the metadata for a file.
    # 
    # Parameters:
    #   file_name - the path for which metadata should be returned
    # 
    # Returns:
    #   A hash containing the metadata.  If the file has no metadata,
    #   an empty hash is returned.  If metadata is not supported on
    #   this platform, `nil` is returned.
    #
    def self.metadata(file_name)
      nil
    end #def

    #
    # Class Method: metadata_keys
    # 
    # Provides the metadata keys that are supported on this platform,
    # along with their associated descriptions.
    # 
    # Returns:
    #   A hash of metadata keys that map to string descriptions.
    #   If metadata is not supported on this platform, `nil` is returned.
    #
    def self.metadata_keys
      nil
    end #def

    #
    # Class Method: description
    # 
    # Provides the description for a file.
    # 
    # Parameters:
    #   file_name - the path for which the description should be returned
    # 
    # Returns:
    #   A description string.  If the file has no description, an empty
    #   string ("") is returned.  If descriptions are not supported on
    #   this platform, `nil` is returned.
    #
    def self.description(file_name)
      nil
    end #def
  
    #
    # Class Method: set_description
    # 
    # Sets the description of a file.
    # 
    # Parameters:
    #   file_name - the path for which the description should be set
    #   text - the string to use for the description
    # 
    # Raises:
    #   An exception if descriptions are not supported on this platform.
    #
    def self.set_description(file_name, text)
      throw "This platform does not support file descriptions."
    end #def

    #
    # Class Method: check_permission
    #
    # Takes a ruby `Dir`-style glob string (i.e. "/some/directory/*") and returns an array of 
    # all the paths in the glob that `account` has permission to access in `mode`.
    # 
    # If the platform does not support permissions, it will return all the glob paths.
    #
    # Parameters:
    #   mode - a symbol representing a file access mode (i.e. :read, :write)
    #   account - an <I3::Account> object that is asking for the file
    #   pattern - a `Dir`-style glob string
    # 
    # Returns:
    #   An array of paths.
    #
    def self.check_permission(mode, account, pattern)
      Dir[pattern]
    end #self.check_permission
    
  end #class

end #module