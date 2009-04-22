#
# File: bboard/meta/search
# 
# Enables site-wide searching in the Bulletin Board tool.
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
#   $Id: search.rb 99 2008-04-16 17:38:49Z nmellis $
# 

require "search/data/model/site-search"
require "bboard/data/model/bboard"

#
# Module: BulletinBoard
#
# The module containing all the BulletinBoard classes and data.
#
module BulletinBoard
  
  #
  # Class: BulletinBoard::BulletinBoardSiteSearch
  #
  # Subclass of <I3::SiteSearch> that returns search results for the BulletinBoard tool.
  #
  class BulletinBoardSiteSearch < I3::SiteSearch
    
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
      acct = Account.find(acct.id)
      
      results = []
      condition = "%#{search_terms}%"
      
      # Find topics that match the search terms
      Topic.find(:all, :conditions => 
          ["name LIKE ? OR description LIKE ?", condition, condition]).each do |topic|
        next unless acct.can_view_topic?(topic)
        results << I3::SiteSearchResult.new(
          :title => topic.name, 
          :uri => "/bboard/topics/#{topic.permalink}", 
          :description => topic.description, 
          :last_modified_at => nil, 
          :small_icon => "/bboard/client-web/img/applet-icon-16.png", 
          :large_icon => "/bboard/client-web/img/applet-icon-32.png" )
      end #each
        
      
      # Find articles that match the search terms
      db = I3.config.tools["bboard"].database
      article_sql =<<-EOS
        SELECT DISTINCT 
          a.id
        FROM #{db}.articles AS a
          INNER JOIN #{db}.topics AS t ON a.topic_id = t.id
          LEFT JOIN #{db}.comments AS c ON a.id = c.article_id
          INNER JOIN i3.people AS p ON a.person_id = p.id
        WHERE
          t.is_external = 0 AND
          a.is_deleted = 0 AND
          (a.subject LIKE '%#{search_terms}%' OR
           a.text LIKE '%#{search_terms}%' OR
           p.first_name LIKE '%#{search_terms}%' OR
           p.last_name LIKE '%#{search_terms}%' OR
           (c.is_deleted = 0 AND c.text LIKE '%#{search_terms}%')
          )
      EOS
      
      Article.find_by_sql(article_sql).each do |article_id|
        article = Article.find(article_id)
        next unless acct.can_view_topic?(article.topic)
        link = "/bboard/topics/#{article.topic.permalink}/#{article.posted_at.year}" + 
          "/#{article.posted_at.mon.to_s.rjust(2,"0")}/#{article.posted_at.day.to_s.rjust(2,"0")}" + 
          "/#{article.permalink}"
        
        results << I3::SiteSearchResult.new(
          :title => article.subject, 
          :uri => link, 
          :description => "Topic: #{article.topic.name}", 
          :last_modified_at => (article.comments.last.posted_at rescue article.posted_at), 
          :small_icon => "/bboard/client-web/img/applet-icon-16.png", 
          :large_icon => "/bboard/client-web/img/applet-icon-32.png" )
      
      end #each
      
      return results
    end #find
    
  end #class BulletinBoardSiteSearch
  
end #module BulletinBoard