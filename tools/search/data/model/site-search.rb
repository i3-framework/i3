#
# File: search/data/model/site-search
#
# Provides a base class for tool search classes.
# 
# To enable site-wide searching for a particular tool, add a "search.rb" file to the tool's 
# "meta" folder and implement a single class that inherits from <I3::Query> and contains the 
# instance method `search_results_for_account` which accepts a `search_terms` argument and an 
# `account` argument.  This method should return an `Array` of <I3::QueryResult> objects for those 
# items that match the supplied search terms and are accessible by `account`.
# 
# Example:
# (start example)
# # File: my-tool/meta/search.rb
# class MyToolQuery < I3::Query
#   
#   def search_results_for_account(search_terms, acct)
#     items = self.find_items_that_match(search_terms)
#     items = items.select { |item| item.viewable_by?(acct) }
#     return items.collect { |item| I3::QueryResult.new(:title => item.title, ...) }
#   end #search_results_for_account
# 
# end #class MyToolQuery
# (end example)
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
#   $Id: site-search.rb 98 2008-04-16 16:34:05Z nmellis $
#

#
# Module: I3
#
# Module containing class definitions and data shared by all
# intranet applications.
#
module I3
  
  #
  # Class: I3::SiteSearch
  #
  # Base class for tool search classes.
  #
  class SiteSearch
    include LoggingSupport
    
    overridable_cattr_accessor :tool_name
    
    @search_classes = []
    
    #
    # Class Method: find
    #
    # Returns a site-wide search result for `search_terms`.  The result will be a hash that 
    # contains symbolized tool names as keys and the search results as the values.
    #
    # Parameters:
    #   search_terms - a `String` containing the search terms
    #   excluded_tools - (optional) an `Array` of tool names to exclude from the search
    #   acct - (optional) the <I3::Account> that is making the request.  If not supplied, 
    #          the value of `I3.server.remote_account` will be used.
    # 
    # Raises:
    #   An <I3::NotFoundException> if no suitable account could be found.
    #
    def self.find(search_terms, excluded_tools=[], acct=nil)
      I3.config.tools.each do |tool_name, tool|
        next if excluded_tools.to_a.include?(tool_name)
        @last_tool_loaded = tool_name
        require "#{tool_name}/meta/search.rb" if tool.is_searchable?
      end #each
      
      # Sanity check
      if acct.nil?
        raise I3::NotFoundException.new(
          :title => "Account not found", 
          :message => "No account could be found for use in I3::SiteSearch.find")
      end #if
      
      # Perform searches
      results = @search_classes.inject(Hash.new) do |hash, klass|
        k = klass.new
        unless excluded_tools.to_a.include?(k.tool_name)
          if acct.has_permission?("access-tool", k.tool_name) or 
             acct.has_permission?("develop", "i3-root")
            begin
              q = k.find(search_terms.to_s, acct)
              hash[k.tool_name] = q if q.size > 0
            rescue
              log.warn "Error while fetching search results: #{$!.message}"
              log.warn $!.backtrace.join("\n")
            end #begin
          end #if
        end #unless
        hash
      end #inject
      
      return results
    end #self.search
    
    #
    # Class Method: inherited
    #
    # Called by Ruby when a subclass is added.  We add this to our cache.
    #
    # Parameters:
    #   subclass - the subclass that was just initialized
    #
    def self.inherited(subclass)
      subclass.tool_name = @last_tool_loaded
      @search_classes << subclass unless @search_classes.include?(subclass)
    end #self.inherited
    
    #
    # Method: find
    #
    # Returns an `Array` of <I3::SiteSearchResult> objects.  This method must be overridden by 
    # subclasses to return the results for `search_terms`.
    # 
    # Parameters:
    #   search_terms - a `String` containing the search terms
    #   acct         - (optional) the <I3::Account> that is requesting the search
    #
    def find(search_terms, acct=nil)
      []
    end #find
    
  end #class SiteSearch
  
  # ================================================================================================
  
  #
  # Class: I3::SiteSearchResult
  #
  # Class for containing the results of an Intranet wide search.  Each object should have the 
  # following properties:
  # 
  #   * title
  #   * uri
  #   * description
  #   * last_modified_at
  #   * small_icon
  #   * large_icon
  #
  class SiteSearchResult < I3::SharedObject
    
    #
    # Method: to_hash
    #
    # Overrides the default `to_hash` method to ensure that all the proper fields have values.
    #
    def to_hash
      {
        :title => self.title.to_s, 
        :uri => self.uri.to_s, 
        :description => self.description.to_s, 
        :last_modified_at => self.last_modified_at, 
        :small_icon => self.small_icon, 
        :large_icon => self.large_icon
      }
    end #to_hash
    
  end #class SiteSearchResult

end #module I3