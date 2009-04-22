#
# Web Service: search/data/search
#
# Place a description for your web service here.
#
# Credits:
# 
#   Written by Nathan Mellis.
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
#   $Id: search.rb 87 2008-04-09 22:18:26Z nmellis $
#

require "search/data/model/site-search"

#
# Module: Search
#
# The module containing all Search the Intranet classes and data.
#
module Search

  #
  # Class: Search::SearchServlet
  #
  # The main servlet for the Search service.
  #
  class SearchServlet < I3::Servlet

    #
    # Method: on_get
    #
    # Returns the search results.
    #
    # Parameters:
    #   path - additional path data provided in the URI; ignored
    #
    def on_get(path)
      search_terms   = I3.server.cgi["q"].to_a.join(" ")
      excluded_tools = I3.server.cgi["exclude"].to_a
      account        = I3.server.remote_account
      I3.server.send_object(I3::SiteSearch.find(search_terms, excluded_tools, account))
    end #on_get

  end #class SearchServlet

end #module Search
