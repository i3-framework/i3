#
# File: framework/intranet/cgi-wrapper
#
# Defines a custom CGI wrapper class that provides access to query string values and form data.
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
#   $Id: cgi-wrapper.rb 64 2008-03-17 19:05:14Z nmellis $
#

require "mongrel"                             # For handling requests
require "mongrel_multipart_extensions"        # Multipart extensions for Mongrel


#
# Module: I3
#
# Module containing class definitions and data shared by all
# intranet applications.
#
module I3
  
  #
  # Class: I3::CGIWrapper
  #
  # Description of class
  #
  class CGIWrapper
    include Enumerable
    
    #
    # Method: new
    #
    # Description of method
    # 
    # Parameters:
    #   request - a <Mongrel::HttpRequest> object
    #
    def initialize(request)
      @params = {}
      @params.merge! request.class.query_parse(request.params["QUERY_STRING"])
      
      # Check to see if a form was submitted and fill in the form values
      if request.is_multipart?
        @params.merge! request.split_multipart
      end #if
    end #initialize
    
    #
    # Method: each
    #
    # Description of method
    #
    def each
      @params.keys.each { |key| yield key, self[key] }
    end #each
    
    #
    # Method: keys
    #
    # Description of method
    #
    def keys
      @params.keys
    end #keys
    
    #
    # Method: []
    #
    # Description of method
    # 
    # Parameters:
    #   key - description
    #
    def [](key)
      values = @params[key].to_a.collect do |item|
        if item.is_a? StringIO or item.is_a? Tempfile
          # Convert any parameters that are file uploads to the <UploadedFile> object
          if item.respond_to? :original_filename and not item.original_filename.to_s.empty?
            UploadedFile.new(item)
          else
            item.rewind
            item.read
          end #if
        else
          item
        end #if
      end #collect
      
      # If we only have one item, just return that
      if values.is_a? Array and not values.size > 1
        values = values.first
      end
      
      return values
    end #method_name
    
  end #class CGIWrapper
  
  # ================================================================================================
  
  #
  # Class: I3::UploadedFile
  #
  # Description of class
  #
  class UploadedFile
    
    #
    # Method: new
    #
    # Description of method
    #
    # Parameters:
    #   io - description
    #
    def initialize(io)
      @io = io
    end #initialize
    
    #
    # Method: read
    #
    # Description of method
    #
    def read
      @io.rewind
      @io.read
    end #read
    
    #
    # Method: size
    #
    # Description of method
    #
    def size
      @io.size
    end #size
    
    #
    # Method: filename
    #
    # Description of method
    #
    def filename
      @io.original_filename
    end #filename
    
    #
    # Method: extension
    #
    # Description of method
    #
    def extension
      File.extname(@io.original_filename)
    end #extension
    
    #
    # Method: content_type
    #
    # Description of method
    #
    def content_type
      @io.content_type
    end #content_type
    
    #
    # Method: local_path
    #
    # Description of method
    #
    def local_path
      @io.local_path
    end #local_path
    
  end #class UploadedFile
  
end #module I3
