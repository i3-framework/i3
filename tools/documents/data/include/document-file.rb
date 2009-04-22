#
# File: documents/data/include/document-file
#
# Document file support.
# 
# This extends <I3::File> to include additional attributes for files that
# are returned from either the document list or search services.
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
#   $Id: document-file.rb 3 2007-12-06 18:32:08Z melfstrand $
#

require "documents/data/include/platform"       # DocumentPlatform support

#
# Module: Documents
#
# Contains classes and data for the Documents tool.
# 
module Documents

  #
  # Class: Documents::DocumentFile
  # 
  # Represents a single file or folder in a directory listing.
  # 
  # In addition to the attributes provided by <I3::File>, `DocumentFile`
  # objects have a <client_path> property that provides a path that clients
  # can request to download the file.
  # 
  # When a `DocumentFile` object is converted to a `Hash` or to JSON format,
  # a `path` attribute is added to the hash that provides the client path.
  #
  class DocumentFile < I3::File

    # Number of parent folders to include when returning the name,
    attr_accessor :parent_folder_levels_in_name

    # Constant: DOC_FILE_PATH
    # Path to the directory containing files and folders to
    # make available to the client.
    DOC_FILE_PATH = I3.config.tools["documents"].settings.document_root ||
                    DocumentPlatform.default_document_root
                    
    # Constant: DOC_LINK_PATH
    # Path to the directory in which temporary symlinks will be
    # created for files being downloaded.
    DOC_LINK_PATH = I3::LOCAL_PATH + "/files/documents"
    
    # Constant: DOC_SERVICE_PATH
    # Path that the client will use to contact the Documents web service.
    DOC_SERVICE_PATH = "/documents/data/documents"
    
    
    # ------------------------------------------------------------------------
    # Group: Class Methods
    # ------------------------------------------------------------------------
    
    #
    # Class Method: find_with_permission
    #
    # Collects all the files and folders in `pattern` that are accessible in `mode` by `account`.
    # 
    # Parameters:
    #   mode - a symbol representing a file access mode (i.e. :read, :write)
    #   account - an <I3::Account> object that is asking for the file
    #   pattern - a `Dir`-style glob string
    # 
    # Returns:
    #   An array of <DocumentFile> objects.
    #
    def self.find_with_permission(mode, account, pattern)
      DocumentPlatform.check_permission(mode, account, pattern).collect do |path|
        self.new(path)
      end #collect
    end #self.find_with_permission
    
    
    # ------------------------------------------------------------------------
    # Group: Instance Methods
    # ------------------------------------------------------------------------
    
    #
    # Method: has_permission?
    #
    # Returns `true` if the `account` has permission to access the file in `mode`.
    #
    # Parameters:
    #   mode - a symbol representing a file access mode (i.e. :read, :write)
    #   account - an <I3::Account> object that is asking for the file
    #
    def has_permission?(mode, account)
      DocumentPlatform.check_permission(mode, account, self.path).size > 0
    end #has_permission?
    
    #
    # Method: client_path
    #
    # Provides a path that the client can use to download the file.
    #
    def client_path
      if @client_path.nil?
        file_path = File.expand_path(self.path)
        @client_path = DOC_SERVICE_PATH + file_path[DOC_FILE_PATH.size..-1]
        @client_path += "/" if self.is_folder?
      end #if
      @client_path
    end #def

    #
    # Method: name
    #
    # Overrides <I3::File::name> to include parent folders if the
    # `parent_folder_levels_in_name` property has been set to a value
    # higher than zero.
    #
    def name
      return super if self.parent_folder_levels_in_name.to_i == 0
      levels = self.parent_folder_levels_in_name + 1
      expanded_path = File.expand_path(self.path)[1..-1] # Strip leading slash
      path_components = expanded_path.split("/")
      return expanded_path if levels >= path_components.size
      return path_components[(0-levels)..-1].join("/")
    end

    #
    # Method: to_hash
    #
    # Overrides <I3::File::to_hash> to provide additional attributes.
    # 
    # Returns:
    #   The `Hash` representing the file object.
    #
    def to_hash
      h = super
      h[:path] = self.client_path
      h
    end #def

  end #class

end #module
