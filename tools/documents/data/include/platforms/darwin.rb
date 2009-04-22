#
# File: documents/data/include/platforms/darwin
# 
# Platform-specific document support for Darwin (Mac OS X).
# 
# The "Spotlight" engine is used for indexing and querying metadata on
# Mac OS X.  This automatically indexes file contents as they are saved
# and keeps file descriptions associated with files, so no additional
# database is necessary that might get out of sync.
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
#   $Id: darwin.rb 127 2008-10-27 20:41:10Z nmellis $
#

require "time"  # Time extensions
require "socket"

#
# Module: Documents
#
# Contains classes and data for the Documents tool.
# 
module Documents
  
  #
  # Class: Documents::DarwinDocumentPlatform
  # 
  # Implementation of DocumentPlatformBase for Mac OS X.
  #
  class DarwinDocumentPlatform < DocumentPlatformBase
    include I3::LoggingSupport
    
    # Command to run to obtain file metadata
    METADATA_GET_COMMAND = "mdls %s '%s'"
    # Fields to include in metadata search
    METADATA_FIELDS = [
      'kMDItemKind', 'kMDItemContentCreationDate',
      'kMDItemContentModificationDate',
      'kMDItemAuthors', 'kMDItemNumberOfPages',
      'kMDItemPixelHeight', 'kMDItemPixelWidth',
      'kMDItemResolutionWidthDPI', 'kMDItemAcquisitionModel'
      ]
    # Command to run to obtain file comment
    COMMENT_GET_COMMAND = 'mdls -name kMDItemFinderComment "%s"'
    # String to search for in comment command results
    COMMENT_GET_PATTERN = /kMDItemFinderComment = "(.*)"/
    # OSA script to set file comment
    COMMENT_SET_SCRIPT = 'tell application "Finder" to ' +
      'set the comment of POSIX file "%s" to "%s"'
    # Command to run to set file comment
    COMMENT_SET_COMMAND = "osascript -e '#{COMMENT_SET_SCRIPT}'"
    # Default host to connect to for permission checker service.
    PERMISSION_CHECKER_DEFAULT_HOST = "127.0.0.1"
    # Default port to connect to for permission checker service.
    PERMISSION_CHECKER_DEFAULT_PORT = 7999
    
    # Class Method: searchable?
    # Returns `true`.
    def self.searchable? ; true ; end
    
    # Class Method: has_metadata?
    # Returns `true`.
    def self.has_metadata? ; true ; end

    # Class Method: has_description?
    # Returns `true`.
    def self.has_description? ; true ; end
    
    # Class Method: supports_permissions?
    # Returns `true`.
    def self.supports_permissions? ; true ; end

    # Class Method: default_document_root
    # Returns "/Shared Items".
    def self.default_document_root ; "/Shared Items" ; end

    #
    # Class Method: make_link_for_file
    # 
    # Creates a temporary directory containing a link to the given
    # `source_file`.  A UUID will be generated for the temporary
    # directory name.
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
      uuid = `uuidgen`.strip
      link_path = "#{dest_dir}/#{uuid}/#{file_name}"
      FileUtils.mkdir_p("#{dest_dir}/#{uuid}")
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
      uuid = `uuidgen`.strip
      FileUtils.mkdir_p(dest_dir)
      File.open(File.join(dest_dir, uuid), "w") { |io| io << src_file.read }
      uuid
    end #self.save_temp_file
    
    #
    # Class Method: search
    # 
    # Performs a filesystem query using the Mac OS X metadata service.
    # 
    # See <Documents::DocumentPlatformBase> for details.
    # 
    # This method right now is slow and un-optimized and should be replaced with a nice speedy
    # C program that will query Spotlight as the specified user so that we don't have to spawn 
    # two processes and open each file that is returned to check access permission.
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
    #   If no files are found, an empty array is returned.
    #   
    def self.search(root, query, account, params=[])
      # Limit root to Public subfolder until a permission system is in place.
      # root = "#{root}/Public"
      if params.size > 0
        params.each do |param|
          param.sub!(/^Kind /, "kMDItemKind ")
          param.sub!(/^Created /, "kMDItemContentCreationDate ")
          param.sub!(/^Modified /, "kMDItemContentModificationDate ")
          param.sub!(/^Authors /, "kMDItemAuthors ")
          param.sub!(/^Pages /, "kMDItemNumberOfPages ")
          param.sub!(/^Height /, "kMDItemPixelHeight ")
          param.sub!(/^Width /, "kMDItemPixelWidth ")
          param.sub!(/^DPI /, "kMDItemResolutionWidthDPI ")
          param.sub!(/^Camera /, "kMDItemAcquisitionModel ")
          param.sub!(/"$/, '"cd')  # make strings case-insensitive
        end #each
        if query && query.size > 0
          params << 
            ('* = "%s*"wcd || kMDItemTextContent = "%s*"cd' % [query, query])
        end #if
        combined_query = params.inject("") do |q, param|
          q + "(" + param + ") && "
        end #inject
        combined_query = combined_query[0..-5]
        results = `mdfind -onlyin '#{root}' '#{combined_query}'`.split("\n")
      else
        results = `mdfind -onlyin '#{root}' '#{query}'`.split("\n")
      end #if
      
      log.debug results
      
      options              = Hash.new
      options[:username]   = account.account_name
      options[:permission] = "read"
      options[:paths]      = results
      return self.run_permission_checker(options)
    end

    #
    # Class Method: metadata
    # 
    # Provides the metadata for a file using the Mac OS X metadata service.
    # 
    # Parameters:
    #   file_name - the path for which metadata should be returned
    # 
    # Returns:
    #   A hash containing the metadata.  If the file has no metadata,
    #   an empty hash is returned.
    #
    def self.metadata(file_name)
      field_list = METADATA_FIELDS.inject("") do |str, field|
        str + " -name " + field
      end #inject
      command = METADATA_GET_COMMAND % [field_list, file_name]
      `#{command}`.split("\n").inject({}) do |hash, line|
        case line
          when /^kMDItemKind \s*= "(.*)"/
            hash["Kind"] = $1
          when /^kMDItemContentCreationDate \s*= (.*)/
            hash["Created"] = Time.parse($1)
          when /^kMDItemContentModificationDate \s*= (.*)/
            hash["Modified"] = Time.parse($1)
          when /^kMDItemAuthors \s*= "\((.*)\)"/
            hash["Authors"] = $1.sub('"', '')
          when /^kMDItemNumberOfPages \s*= (.*)/
            hash["Pages"] = $1.to_i
          when /^kMDItemPixelHeight \s*= "(.*)"/
            hash["Height"] = $1.to_i
          when /^kMDItemPixelWidth \s*= "(.*)"/
            hash["Width"] = $1.to_i
          when /^kMDItemResolutionWidthDPI \s*= "(.*)"/
            hash["DPI"] = $1.to_f
          when /^kMDItemAcquisitionModel \s*= "(.*)"/
            hash["Camera"] = $1
        end #case
        hash
      end #inject
    end #def

    #
    # Class Method: metadata_keys
    # 
    # Provides the metadata keys that are supported by this implementation,
    # along with their associated descriptions.
    # 
    # Returns:
    #   A hash of metadata keys that map to string descriptions.
    #
    def self.metadata_keys
      return {
        "Kind" => "Kind of file",
        "Created" => "Date the file was created",
        "Modified" => "Date the file was last modified",
        "Authors" => "Array of authors (documents only)",
        "Pages" => "Number of pages (PDF documents only)",
        "Height" => "Pixel height (images only)",
        "Width" => "Pixel width (images only)",
        "DPI" => "Dots per inch (images only)",
        "Camera" => "Camera model (JPEG images only)"
      }
      nil
    end #def

    #
    # Class Method: description
    # 
    # Provides the Finder comment for a file.
    # 
    # Parameters:
    #   file_name - the path for which the description should be returned
    # 
    # Returns:
    #   A description string.  If the file has no description, an empty
    #   string ("") is returned.
    #
    def self.description(file_name)
      command = COMMENT_GET_COMMAND % file_name
      match = `#{command}`.scan(COMMENT_GET_PATTERN)[0]
      return (match.nil?) ? "" : match[0]
    end #def
  
    #
    # Class Method: set_description
    # 
    # Sets the Finder comment for a file.
    # 
    # Parameters:
    #   file_name - the path for which the description should be set
    #   text - the string to use for the description
    #
    def self.set_description(file_name, text)
      file_name = File.expand_path(file_name)
      command = COMMENT_SET_COMMAND % [file_name, text]
      `#{command}`
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
    # See Also:
    #   <run_permission_checker>
    #
    def self.check_permission(mode, account, pattern)
      options              = Hash.new
      options[:username]   = account.account_name
      options[:permission] = mode.to_s
      options[:paths]      = Dir[pattern]
      return self.run_permission_checker(options)
    end #self.check_permission
    
    #
    # Private Class Method: run_permission_checker
    #
    # Connects to the permission checker service to verify that a user has a specific access
    # to one or more paths.
    # 
    # The `options` hash is expected to contain the following
    # keys:
    # 
    #   :username - the account name of the person to check permissions for
    #   :permission - "read" or "write"
    #   :paths - an array of paths to check the user's access for
    # 
    # Parameters:
    #   options - a hash of options, as described above
    # 
    # Returns:
    #   The subset of the given paths to which the user has access.
    #
    def self.run_permission_checker(options)
      host = I3.config.tools["documents"].settings.host || PERMISSION_CHECKER_DEFAULT_HOST
      port = I3.config.tools["documents"].settings.permission_service_port || 
             PERMISSION_CHECKER_DEFAULT_PORT
      begin
        session = TCPSocket.new(host, port)
        YAML.dump(options).each { |line| session.puts line }
        session.puts    # Service needs a terminating newline
      
        response = ""
        while output = session.gets
          response << output
        end
      
        session.close
        return response.split("\n")
      rescue Exception => ex
        log.error "Cannot check permission for %s: %s" % [ options[:username], ex.message ]
        return []
      end
    end #self.run_permission_checker
    
  end #class
  
end #module