#
# File: documents/meta/search
# 
# Enables site-wide searching in the Documents tool.
# 
# Credits:
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
#   $Id: search.rb 95 2008-04-12 20:12:04Z nmellis $
# 

require "search/data/model/site-search"
require "documents/data/include/document-file"  # DocumentFile support
require "documents/data/include/platform"       # DocumentPlatform support

#
# Module: Documents
#
# The module containing all the Documents classes and data.
#
module Documents
  
  #
  # Class: Documents::DocumentsSiteSearch
  #
  # Subclass of <I3::SiteSearch> that returns search results for the Documents tool.
  #
  class DocumentsSiteSearch < I3::SiteSearch
    
    #
    # Method: find
    #
    # Returns the search results for `search_terms` that are viewable by `acct`.
    #
    # Parameters:
    #   search_terms - a `String` of search terms
    #   acct - the <I3::Account> that is requesting the search
    # 
    # Returns:
    #   An `Array` of <I3::SiteSearchResult> objects.
    #
    def find(search_terms, acct)
      if DocumentPlatform.searchable?
        results = DocumentPlatform.search(DocumentFile::DOC_FILE_PATH, search_terms, acct)
        log.info "Documents Site Search performed for '%s' with %d results." % 
                  [search_terms, results.size]
        files = results.collect { |path| DocumentFile.new(path) }
        return files.sort { |a,b| a.name <=> b.name }.collect do |file|
          I3::SiteSearchResult.new(
            :title => file.name, 
            :uri => file.client_path, 
            :description => file.client_path.match(%r'^/documents/data/documents/(.+)/[^/]+$').to_a[1], 
            :last_modified_at => file.modified_at, 
            :small_icon => file.small_icon, 
            :large_icon => file.large_icon )
        end #collect
      else
        log.error "Documents Site Search not performed for '#{search_terms}': " +
                  "service is not available on this platform."
        return []
      end #if
    end #find
    
  end #class DocumentsSiteSearch
  
end #module Documents