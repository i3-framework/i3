#
# File: documents/data/include/platforms/linux
# 
# Platform-specific document support for Linux.
# 
# Credits:
# 
#   Written by
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
#   $Id: linux.rb 127 2008-10-27 20:41:10Z nmellis $
#

require "time"  # Time extensions
require "socket"
require "base64"
require "documents/data/include/document-file"

#
# Module: Documents
#
# Contains classes and data for the Documents tool.
# 
module Documents
  
  #
  # Class: Documents::LinuxDocumentPlatform
  # 
  # Implementation of DocumentPlatformBase for Linux
  #
  class LinuxDocumentPlatform < DocumentPlatformBase
    include I3::LoggingSupport
    
    # Default host to connect to for the documents service.
    SERVICE_DEFAULT_HOST = "127.0.0.1"
    # Default port to connect to for permission service.
    PERMISSION_SERVICE_DEFAULT_PORT = 7999
    # Default port to connect to for the search service.
    SEARCH_SERVICE_DEFAULT_PORT = 7998
    # Default limit for search results
    SEARCH_SERVICE_DEFAULT_LIMIT = 100
    
    
    # Class Method: searchable?
    # Returns `true`.
    def self.searchable? ; true ; end
    
    # Class Method: has_metadata?
    # Returns `true`.
    def self.has_metadata? ; false ; end

    # Class Method: has_description?
    # Returns `true`.
    def self.has_description? ; false ; end
    
    # Class Method: supports_permissions?
    # Returns `true`.
    def self.supports_permissions? ; true ; end

    # Class Method: default_document_root
    # Returns "/Shared Items".
    def self.default_document_root ; "/srv/www/i3-local/files/documents-root" ; end

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
    # Performs a filesystem query using the i3 Documents Search service.
    # 
    # See <Documents::DocumentPlatformBase> for details.
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
      limit = I3.config.tools["documents"].settings.search_service_limit || 
              SEARCH_SERVICE_DEFAULT_LIMIT
      
      begin
        credential_line = I3.server.request.params["HTTP_AUTHORIZATION"]
        credential_type, credentials = credential_line.split(" ", 2)

        options                   = Hash.new
        options[:credential_type] = credential_type
        options[:credentials]     = credentials
        options[:scope]           = root.sub(DocumentFile::DOC_FILE_PATH, "")
        options[:limit]           = limit
        options[:query]           = query

        self.run_search(options)
      rescue
        log.error $!.message
        log.debug $!.backtrace.join("\n")
        return []
      end
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
      nil
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
      nil
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
      begin
        credential_line = I3.server.request.params["HTTP_AUTHORIZATION"]
        credential_type, credentials = credential_line.split(" ", 2)
      
        options                   = Hash.new
        options[:credential_type] = credential_type
        options[:credentials]     = credentials
        options[:permission]      = mode.to_s
        options[:paths]           = Dir[pattern].collect { |p| p.sub(DocumentFile::DOC_FILE_PATH, "") }
        
        log.debug Dir[pattern].collect { |p| p.sub(DocumentFile::DOC_FILE_PATH, "") }

        self.run_permission_checker(options)
      rescue
        log.error $!.message
        log.debug $!.backtrace.join("\n")
        return []
      end
    end #self.check_permission
    
    #
    # Private Class Method: run_permission_checker
    #
    # Description of method
    #
    # Parameters:
    #   options - description
    #
    def self.run_permission_checker(options)
      host = I3.config.tools["documents"].settings.host || SERVICE_DEFAULT_HOST
      port = I3.config.tools["documents"].settings.permission_service_port || 
             PERMISSION_SERVICE_DEFAULT_PORT
      begin
        session = TCPSocket.new(host, port)
        session.puts options.to_json
        session.close_write
        
        response = ""
        while output = session.gets
          response << output
        end
        session.close
        
        return response.split("\n").collect { |p| File.join(DocumentFile::DOC_FILE_PATH, p) }
      rescue Exception
        username = Base64.decode64(options[:credentials]).split(":", 2)[0]
        log.error "Cannot check permission for %s: %s" % [ username, $!.message ]
        log.debug $!.backtrace.join("\n")
        return []
      end #begin
    end #self.run_permission_checker
    
    #
    # Private Class Method: run_search
    #
    # Description of method
    #
    # Parameters:
    #   options - description
    #
    def self.run_search(options)
      host  = I3.config.tools["documents"].settings.host || SERVICE_DEFAULT_HOST
      port  = I3.config.tools["documents"].settings.search_service_port || 
              SEARCH_SERVICE_DEFAULT_PORT
      begin
        session = TCPSocket.new(host, port)
        session.puts options.to_json
        session.close_write
        
        response = ""
        while output = session.gets
          response << output
        end
        session.close
        
        return response.split("\n").collect { |p| File.join(DocumentFile::DOC_FILE_PATH, p) }
      rescue Exception
        username = Base64.decode64(options[:credentials]).split(":", 2)[0]
        log.error "Cannot perform search for %s: %s" % [ username, $!.message ]
        log.debug $!.backtrace.join("\n")
        return []
      end #begin
    end #self.run_search
    
  end #class
  
end #module