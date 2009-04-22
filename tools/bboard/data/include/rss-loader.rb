#
# File: bboard/data/include/rss-loader
#
# Contacts the RSS web services for the external news data and updates
# the bulletin board tables with the latest articles.  Each news source
# is limited to the 10 most recent items.
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
#   $Id: rss-loader.rb 2 2007-12-06 00:18:23Z melfstrand $
#

require "net/http"
require "rss/1.0"
require "rss/2.0"
require "stringio"
require "time"
require "zlib"

require 'bboard/data/model/bboard'

#
# Module: BulletinBoard
#
# The module containing all Bulletin Board classes and data.
#
module BulletinBoard

  #
  # Class: BulletinBoard::NewsLoader
  # 
  # Refreshes the news data from RSS feeds.
  #
  class NewsLoader
    include I3::LoggingSupport
  
    # Constant: MAX_ARTICLES
    # No more than this many articles will be allowed per news source.
    MAX_ARTICLES = 10
  
    #
    # Method: refresh_all
    # 
    # Refreshes all external news topics.
    #
    def refresh_all
      success_count = 0
      error_count = 0
      Topic.find_all_external.each do |topic|
        permalink = topic.permalink
        begin
          refresh_topic(topic)
          success_count += 1
        rescue
          log.error "Error refreshing news for '#{permalink}': #{$!}"
          error_count += 1
        end
      end #each
      if error_count > 0
        STDERR.puts "*** #{error_count} errors occurred while refreshing " +
                    "the news data."
        STDERR.puts "See the intranet log for details."
      end #if
      log.info "#{success_count} news topics were updated successfully."
    end #def

    #
    # Method: refresh_topic
    # 
    # Refreshes a single news topic.
    #
    # Parameters:
    #   topic - the <Topic> object into which the data will be loaded
    #
    def refresh_topic(topic)
    
      # Read the RSS feed from the web site.
      response = Net::HTTP.get_response(URI.parse(topic.external_uri))
      throw response.message unless response.is_a? Net::HTTPOK

      # Parse the feed.
      body = response.body
      if response["content-encoding"] == "gzip"
        gzip_reader = Zlib::GzipReader.new(StringIO.new(body))
        body = gzip_reader.read
        gzip_reader.close
      end #if
      rss = nil
      begin
        rss = RSS::Parser.parse(body)
      rescue RSS::InvalidRSSError
        rss = RSS::Parser.parse(body, false)
      end
      throw "Could not parse RSS feed." if rss.nil?

      # Copy the data for the topic itself.
      topic.name = rss.channel.title unless rss.channel.title.nil?
      topic.description = rss.channel.description
      topic.copyright = rss.channel.copyright
    
      # Copy the articles.
      ignore_count = 0
      rss.items.reverse_each do |item|
        # See if this article already exists.
        permalink = case
          when item.guid
            item.guid.content
          when item.link
            item.link
          when (item.pubDate and item.title)
            item.pubDate.strftime("%Y/%m/%d/") + item.title.to_permalink
          else
            nil
        end #case
        if permalink.nil?
          ignore_count += 1
        else
          matches = topic.articles.find(:all,
            :conditions => ["permalink = ?", permalink],
            :order => "posted_at DESC")
          if matches.size > 0
            article = matches[0]
          else
            article = Article.new
            article.permalink = permalink
            topic.articles << article
          end #if
          article.subject = item.title
          article.author_name = item.author
          article.text = item.description
          article.external_uri = item.link
          if item.pubDate.nil?
            article.posted_at = Time.now.utc if article.posted_at.nil?
          else
            article.posted_at = item.pubDate.utc
          end #if
          article.save
        end #if
      end #each
      if ignore_count > 0
        log.warn "#{ignore_count} articles were skipped " +
                 "for topic #{topic.name}"
      end #if
    
      # Remove old articles.
      if topic.articles.size > MAX_ARTICLES
        sorted_articles = topic.articles.find(:all, :order=>"posted_at DESC")
        topic.articles.delete(sorted_articles[MAX_ARTICLES..-1])
      end #if
    
    end #def
  
  end #class

end #module
