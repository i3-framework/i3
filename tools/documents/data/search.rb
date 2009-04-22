#
# Web Service: documents/data/search
#
# Searches for documents based on criteria sent by the client.
# 
# Search terms are specified in the requested URL using a parameter
# called "q".  For example:
# 
# (start example)
#     GET /documents/data/search?q=Policy
# (end example)
# 
# The results of the search are sent as <Documents::DocumentFile> objects.
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
#   $Id: search.rb 128 2008-10-27 21:02:28Z nmellis $
#

require "documents/data/include/document-file"  # DocumentFile support
require "documents/data/include/platform"       # DocumentPlatform support

#
# Module: Documents
#
# Contains classes and data for the Documents tool.
# 
module Documents

  #
  # Class: Documents::SearchServlet
  # 
  # Servlet for the document search web service.
  #
  class SearchServlet < I3::Servlet

    #
    # Method: on_get
    # 
    # Provides the list of files and directories that match a query.
    # The query is expected to be supplied as the "q" CGI parameter.
    # 
    # Parameters:
    #   path - additional path data provided in the URI; ignored
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
      
      query = I3.server.cgi["q"]
      if query.to_s.size == 0
        I3.server.send_object(response)
        return
      end #if
      if DocumentPlatform.searchable?
        # I3.server.send_header
        onlyin = I3.server.cgi["in"] || ""
        results = DocumentPlatform.search(
          DocumentFile::DOC_FILE_PATH + onlyin, query, I3.server.remote_account)
        log.info "Search performed for '%s' with %d results." %
                 [query, results.size]
        response[:files] = results.collect { |path| DocumentFile.new(path) rescue nil }.compact
        I3.server.send_object(response)
      else
        log.error "Search not performed for '#{query}': " +
                  "service is not available on this platform."
        I3.server.send_error(
          :status => "500 Internal Server Error",
          :title => "Service Not Supported",
          :message => "The document search web service is not available " +
            "on this server's operating system.")
      end #if
    end #def

  end #class

end #module
