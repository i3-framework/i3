#
# Web Service: documents/data/documents
#
# Sends a document directory listing to the client.  This is called from
# the Documents web client whenever it needs to retrieve a list of files
# for a path. 
# 
# *Retrieving an overview*
# 
# If no path is provided, the web service sends an overview.  The primary
# attribute of the overview is the `sections` array, which contains one or
# more <Documents::DocumentSection> objects.  Each section has a `name` for
# display, a `kind` ("public" or "protected"), a `path` to the root of the
# section, and a `files` array that provides the list of entries in the
# section as <Documents::DocumentFile> objects.
# 
# There is always a single section with a `kind` of "public".  The files in
# this section are available to all intranet users.  If there is a folder
# called "Departments" in this section, its contents will also be included
# in the `files` array, with a "Departments/" prefix on each file name.
#
# There may be more sections with a `kind` of "protected".  These files are
# available only to the user's department.  Currently just one protected
# section is sent, but it is possible that more will be sent in the future
# if required.
# 
# *Retrieving folder lists*
# 
# If a specific path is sent that resolves to a folder, the `sections`
# array will contain a single <Documents::DocumentSection> object.  The
# `name` and `path` of the section will reflect the folder's name and path,
# and the `files` array will contain the list of files in the folder.
# 
# *Retrieving files*
# 
# If a specific path is sent that resolves to a single file, the client
# will be sent an empty response with a "Location" HTTP header that redirects
# to the actual file.
# 
# *Additional attributes*
# 
# The object that is sent to the client always contains several additional
# attributes that inform the client of the capabilities of the server.
# The "is_searchable" attribute is `true` if the <documents/data/search>
# web service can be called; the client can use this to determine whether
# to display a search box or not.  The "has_description" attribute is `true`
# if the client can expect descriptions in `DocumentFile` objects.  The
# "has_metadata" attribute is `true` if the client can expect additional
# metadata to be available in `DocumentFile` objects.
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
#   $Id: documents.rb 66 2008-03-17 19:16:01Z nmellis $
#


require "documents/data/include/document-file"  # DocumentFile support
require "documents/data/include/uploaded-file"  # UploadedFile support
require "documents/data/include/platform"       # DocumentPlatform support

#
# Module: Documents
#
# Contains classes and data for the Documents tool.
# 
module Documents
  
  #
  # Class: Documents::DocumentsServlet
  # 
  # Main servlet for the Documents web service.
  #
  class DocumentsServlet < I3::Servlet

    #
    # Method: on_get
    # 
    # Provides the list of files and directories for the given path,
    # along with information about the features of the server.  See
    # the file documentation for more information.
    #
    # Parameters:
    #   path - additional path data provided in the URI
    #
    def on_get(path)
      response = {}
      
      # Compile a list of the user's shares if requested
      if I3.server.cgi["with-shares"] == "true"
        response[:shares] = []
        DocumentFile.find_with_permission(:read, I3.server.remote_account, 
          DocumentFile::DOC_FILE_PATH + "/*").each do |file| 
          response[:shares] << file if File.directory? file
        end
        response[:collections] = I3.config.tools["documents"].settings.collections
      end #if
      log.debug "Documents currently processing path: #{path}"
      # Process the request
      if path.strip.size > 1
        # We were provided with a path.
        # If a collection is requested, send that
        if path.starts_with? "/Collections"
          response.merge! self.send_collection(path.sub("/Collections/", "/"))
        elsif File.directory?(DocumentFile::DOC_FILE_PATH + path)
          path += "/" if path[-1..-1] != "/"
          if path =~ /^\/[^\/]+\/$/
            # If the path has only one element, send an overview of that folder
            response.merge! self.send_overview(path)
          else
            # Send a DocumentSection with the folder contents.
            response.merge! self.send_folder(path)
          end
        else
          # Redirect to the file location.
          self.send_file(path)
          return
        end #if
      else
        # TODO - Determine the user's group share and send that folder.
        overview_folder = I3.config.tools["documents"].settings.default_overview_folder
        log.debug "#{I3.server.remote_account.account_name} is in #{overview_folder}"
        response.merge! self.send_overview("/#{overview_folder}/")
      end #if
      
      I3.server.send_object response
    end #on_get
    
    #
    # Method: on_post
    #
    # Handles the HTTP `POST` method.  Used for uploading files.  The folder to save the file in 
    # will be in the extra `path` components.  The file can be retrieved using the `I3.server.cgi` 
    # object.
    # 
    # Assuming we have a valid directory and a valid file, we will check to make sure that the user 
    # has permission to write to the directory and that there isn't a file already present with the 
    # same name.  If there is, the uploaded file will be saved to a temporary location and an 
    # error will be sent back, allowing them to specify that they wish to overwrite the file or 
    # to save it with a different name.
    #
    # Parameters:
    #   path - additional path data provided in the URI
    #
    def on_post(path)
      acct = I3.server.remote_account
      local_path = DocumentFile::DOC_FILE_PATH + path
      
      # Sanity checks
      unless File.directory?(local_path)
        send_uploaded_file_response I3::NotFoundException.new(
          :message => "The path '#{path}' could not be found.")
        return
      end #unless
      
      if DocumentPlatform.check_permission(:write, acct, local_path).empty?
        send_uploaded_file_response I3::SecurityException.new(
          :message => "You do not have permission to write to folder '#{path}'")
        return
      end #if
      
      # We are good to go so far, so let's grab the file
      file = I3.server.cgi["fileToUpload"]
      filename = file.filename
      
      # Internet Explorer will sometimes send the whole path.  We only want the filename.
      filename = filename.split("\\").last if filename =~ /\w:\\/
      
      begin
        response = UploadedFile.save_as(filename, file, local_path)
        send_uploaded_file_response response
        
      rescue I3::SecurityException
        log.warn "User #{acct.account_name} tried to upload a file to '#{path}' and was denied."
        send_uploaded_file_response $!
        
      rescue FileAlreadyExistsException
        log.warn "User #{acct.account_name} failed to save file '#{File.join(path, filename)}'" + 
                 " (#{$!.message})"
        response = $!.to_shared
        response.temp_file = UploadedFile.save_as_temp(file)
        response.path = path
        response.original_filename = filename
        response.overwritable = (not DocumentPlatform.check_permission(
          :write, acct, File.join(local_path, filename)).empty?)
        send_uploaded_file_response response
      rescue
        log.warn "User #{acct.account_name} failed to save file '#{File.join(path, filename)}'" + 
                 " (#{$!.message})"
        send_uploaded_file_response I3::ServerException.new(
          :title => "Could not save file", 
          :message => $!.message )
      end #begin
      
    end #on_post
    
    #
    # Method: on_put
    #
    # Handles the `PUT` HTTP method.
    # 
    # This method is used to update a specific file, or to specify that a temporary file upload 
    # should be saved under a different name.
    # 
    # Parameters:
    #   path - additional path data provided in the URI
    #
    def on_put(path)
      local_path = DocumentFile::DOC_FILE_PATH + File.dirname(path)
      filename   = File.basename(path)
      data = I3.server.receive_object
      
      if data.respond_to? :temp_file
        temp_file_path = File.join(UploadedFile::TEMP_FOLDER, data.temp_file)
        unless File.exists? temp_file_path
          I3.server.send_object I3::NotFoundException.new(:message => "Could not find temp file.")
        end #unless
        
        begin
          temp_file = File.new(temp_file_path)
          response = UploadedFile.save_as(filename, temp_file, local_path, true)
          I3.server.send_object response

        rescue I3::SecurityException
          log.warn "User #{acct.account_name} tried to upload a file to '#{path}' and was denied."
          I3.server.send_object $!

        rescue
          log.warn "User #{acct.account_name} failed to save file '#{File.join(path, filename)}'" + 
                   " (#{$!.message})"
          I3.server.send_object I3::ServerException.new(
            :title => "Could not save file", 
            :message => $!.message )
        end #begin
        
      end #if
    end #on_put
    
    # ----------------------------------------------------------------------------------------------
    
    #
    # Method: send_uploaded_file_response
    #
    # Sends the response from a file upload request.  Because of the way that we have to do 
    # file uploads in our web client (and the fact that Internet Explorer is broken), we have to 
    # check to see if the requestee is Internet Explorer and send the response as HTML rather 
    # than a `type=text/javascript` object.
    # 
    # Parameters:
    #   obj - the object to be sent back to the client
    #
    def send_uploaded_file_response(obj)
      request = I3.server.request
      if request.params["HTTP_USER_AGENT"] =~ /MSIE/     # Internet Explorer
        obj = obj.to_shared if obj.is_a? I3::ServerException
        I3.server.send_object(obj, :type => "text/html")
      else
        I3.server.send_object(obj)
      end #if
    end #send_uploaded_file_response
    
    #
    # Method: send_overview
    #
    # Sends the documents overview to the client.
    # 
    # Parameters:
    #   path - the path to the folder to be sent
    #
    def send_overview(path)
      response = self.create_section_response
      public_section = DocumentSection.from_path(path, :include => "Departments")
      public_section.name = path.split("/")[1]
      response[:sections] << public_section
      return response
    end
    
    #
    # Method: send_collection
    #
    # Sends a collection of all the folders with name `path`.
    #
    # Parameters:
    #   path - the folder name to search in each folder
    #
    def send_collection(path)
      response = self.create_section_response
      Dir.glob("#{DocumentFile::DOC_FILE_PATH}/*#{path}").each do |collection_path|
        section_path = collection_path.sub(DocumentFile::DOC_FILE_PATH, "")
        section_path += "/" unless section_path.ends_with? "/"
        section = DocumentSection.from_path(section_path)
        response[:sections] << section if section.files.size > 0
      end #each
      return response
    end #send_collection
  
    #
    # Method: send_folder
    #
    # Sends a single folder listing to the client.
    # 
    # Parameters:
    #   path - the path of the folder to be sent
    #
    def send_folder(path)
      response = self.create_section_response
      section = DocumentSection.from_path(path)
      Dir.chdir(DocumentFile::DOC_FILE_PATH + path) do |dir|
        if (readmes = Dir.glob("read*me.{html,htm,txt}", File::FNM_CASEFOLD)).size > 0
          section.readme = {
            :type => (File.extname(readmes[0]) == ".txt" ? "text-plain" : "text-html"), 
            :text => File.read(readmes[0]), 
            :file => readmes[0]
          }
        end
      end #Dir.chdir
      response[:sections] << section
      return response
    end
    
    #
    # Method: send_file
    #
    # Redirects the client to a file download.
    # 
    # Parameters:
    #   path - the path of the file to be sent
    #
    def send_file(path)
      link_path = DocumentPlatform.make_link_for_file(
        DocumentFile::DOC_FILE_PATH + path,
        DocumentFile::DOC_LINK_PATH)
      redirect_path =
        "/documents/files" + link_path[DocumentFile::DOC_LINK_PATH.size..-1]
      I3.server.send_header("Location" => redirect_path)
    end
    
    #
    # Method: create_section_response
    # 
    # Builds a `Hash` containing the common server attributes that
    # all section-based responses contain.
    # 
    # Returns:
    #   The constructed `Hash`.
    # 
    def create_section_response
      response = Hash.new
      response[:is_searchable]        = DocumentPlatform.searchable?
      response[:has_description]      = DocumentPlatform.has_description?
      response[:has_metadata]         = DocumentPlatform.has_metadata?
      response[:supports_permissions] = DocumentPlatform.supports_permissions?
      response[:sections]             = []
      return response
    end #def

  end #class

  #
  # Class: Documents::DocumentSection
  # 
  # Represents a section of the Documents structure.  This is frequently
  # used to represent the contents of a single folder, but sections may
  # descend into child folders (see <from_path>).  Each section has the
  # following attributes:
  # 
  #   name - the display name for the section
  #   kind - the kind of section it is (`:public` or `:private`)
  #   path - the path to the section's folder (as seen by the client)
  #   files - an array of <Documents::DocumentFile> objects representing
  #     the files and folders contained in the section
  #
  class DocumentSection < I3::SharedObject

    #
    # Class Method: from_path
    # 
    # Creates and returns a new <DocumentSection> object containing the
    # list of files in the given path.
    #  
    # An `:include` option may be supplied in the `options` hash that
    # specifies an array of folder names.  Any folders that are encountered
    # that match one of these names will have their contents included in
    # the `files` attribute.
    # 
    # Parameters:
    #   path - the path for which the file list should be retrieved
    #   options - optional; `Hash` that may contain an `:include` option
    #
    def self.from_path(path, options=nil)
      acct = I3.server.remote_account
      full_path = DocumentFile::DOC_FILE_PATH + path

      # Fill in data from path.
      section = self.new
      section.name = File.basename(path)
      section.path = DocumentFile::DOC_SERVICE_PATH + path
      section.share_name = path.split("/")[1]
      section.kind = path.starts_with?("/Public/") ? :public : :private
      section.writable = (not DocumentPlatform.check_permission(:write, acct, full_path).empty?)

      # Build included directory list.
      if options and options.has_key? :include
        included_dirs = options[:include]
      else
        included_dirs = []
      end #if
      included_dirs = [included_dirs] unless included_dirs.is_a? Array

      # Add files from directory.
      section.files = []
      DocumentFile.find_with_permission(:read, acct, "#{full_path}*").each do |file|
        if file.is_folder? and included_dirs.include? file.name
          # This is an included directory that needs a folder name
          # prepended to the file name.
          DocumentPlatform.check_permission(:read, acct, "#{file.path}/*").each do |dir|
            share = DocumentFile.new(dir)
            share.parent_folder_levels_in_name = 1
            section.files << share
          end #each
        else
          section.files << file
        end #if
      end #each
      
      section.files.sort { |a,b| a.client_path <=> b.client_path }
      return section
    end #def

  end #class

end #module
