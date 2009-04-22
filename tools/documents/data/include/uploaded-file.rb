#
# File: documents/data/include/uploaded-file
#
# Uploaded file support.
# 
# Provides a series of class methods helpful for handling uploaded files.
#
# Credits:
# 
#   Written by Nathan Mellis (nathan@mellis.us).
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
#   $Id: uploaded-file.rb 66 2008-03-17 19:16:01Z nmellis $
#

require "documents/data/include/platform"       # DocumentPlatform support
require "documents/data/include/document-file"  # DocumentFile class

#
# Module: Documents
#
# Contains classes and data for the Documents tool.
# 
module Documents

  #
  # Class: Documents::FileAlreadyExistsException
  #
  # Exception to be thrown when a file about to be written over.
  #
  class FileAlreadyExistsException < I3::ServerException
    set_default_status  "409 Conflict"
    set_default_title   "File already exists"
    set_default_message "You are attempting to save a file that already exists."
  end #class FileAlreadyExistsException

  #
  # Class: Documents::UploadedFile
  # 
  class UploadedFile
    include I3::LoggingSupport
    
    TEMP_FOLDER = "#{I3::LOCAL_PATH}/files/uploads-temp"
    
    #
    # Class Method: save_as
    #
    # Description of method
    #
    # Parameters:
    #   filename - description
    #   file - description
    #   path - description
    #   overwrite - description
    #
    def self.save_as(filename, file, path, overwrite=false)
      # Internet Explorer will sometimes send the whole path.  We only want the filename.
      filename = filename.split("\\").last if filename =~ /\w:\\/
      
      path = File.expand_path(path)
      full_path = File.join(path, filename)
      
      # Security check
      if File.exists?(full_path)
        unless overwrite
          raise FileAlreadyExistsException
        end #unless
        if DocumentPlatform.check_permission(:write, I3.server.remote_account, full_path).empty?
          raise I3::SecurityException.new(
            :message => "You don't have permission to write to this file.")
        end #if
      end #if
      
      File.open(full_path, "w") { |io| io << file.read }
      return DocumentFile.new(full_path)
    end #self.save_as
    
    #
    # Class Method: save_as_temp
    #
    # Saves an uploaded file to a temporary location so the user can be prompted to give a new 
    # filename or overwrite an existing file.
    # 
    # Parameters:
    #   file - the file to save
    # 
    # Returns:
    #   A `uuid` string that the file was saved as.
    #
    def self.save_as_temp(file)
      DocumentPlatform.save_temp_file(file, TEMP_FOLDER)
    end #self.save_as_temp
    
  end #class UploadedFile
  
end #module Documents
