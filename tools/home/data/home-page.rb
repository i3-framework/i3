#
# Web Service: home/data/home-page
#
# Provides the data displayed by the Home Page web client.  The service
# responds only to `GET` requests, and will send an object containing
# three arrays, named `link_list`, `news`, and `weather`.
# 
# The `link_list` array will contain a list of sections to display in
# the left-hand sidebar on the home page, each of which has a `section`
# key specifying the title, an `icon` key specifying the icon to display,
# a `links` key specifying the array of links to display in the section.
# Each link has either a `tool` key that names a tool short name, or a
# `uri` key with a full URI to link to.  Each link has a `caption`
# property to specify the text to appear for the link, and tool links
# may optionally have a `path` property that specifies a sub-path to link
# to inside the tool.
# 
# The `news` array will contain a list of topics, each of which has a
# `name`, a boolean `is_external` value (set to `true` if the news topic
# is from an external RSS feed, or `false` if it comes from the intranet
# bulletin board), and an `articles` array.  Each article in the array
# will have a `subject`, a `posted_at` date, an `author` field telling who
# posted it (not always available for RSS articles), and a `uri` that tells
# where to find the full article text.
# 
# The `weather` array will contain a list of cities, each of which has
# a `city_name`, a `city_code`, and the current `temperature`, `conditions`,
# `feels_like` temperature, and other values.  In addition, the weather
# city will have a set of `forecasts`, which is an array of forecast
# objects that feature `date`, `high`, `low`, `conditions`, and
# `chance_of_precipitation` fields.
# 
# The data also includes -- in addition to the `news` and `weather` arrays
# mentioned above -- a tip-of-the-day (`tip`) and a boolean value telling
# whether the user is new to the intranet (`first_time`).
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
#   $Id: home-page.rb 19 2007-12-11 23:37:22Z melfstrand $
#

require "home/data/model/home-page"             # HomePage data model
require "bboard/data/model/bboard"              # BBoard data model

#
# Module: Home
#
# The module containing all Home Page classes and data.
# 
module Home
  
  #
  # Class: Home::HomePageServlet
  # 
  # Main servlet for Home Page service
  #
  class HomePageServlet < I3::Servlet

    #
    # Method: on_get
    # 
    # Called when a `GET` request is received.  Sends the user's preferred
    # news and weather.
    # 
    # Parameters:
    #   path - additional path data provided in the URI; ignored
    #
    def on_get(path)
      I3.server.send_object(build_page_for_user)
    end #def

    #
    # Method: build_page_for_user
    # 
    # Constructs the home page object for the current user.
    # 
    # Returns:
    #   An <I3::SharedObject> containing `news`, `weather`, `tip`, and
    #   `first_time` properties.
    #
    def build_page_for_user

      # Create the result base.
      result = I3::SharedObject.new
      result.first_time = false
      result.link_list = []
      result.news = []
      result.weather = []
      result.tip = ""
      
      # Add the list of links.
      link_list_setting = I3.config.tools["home"].settings.navigation || []
      link_list_setting.each do |section_setting|
        new_section = { :section => section_setting[:section], :links => [] }
        new_section[:tool] = section_setting[:tool] if section_setting[:tool].to_s.size > 0
        # Determine the icon for the section.
        if section_setting[:icon].to_s.size > 0
          new_section[:icon] = "/" +
              section_setting[:icon].to_s.sub("/", "/client-web/img/") + "-32.png"
        elsif section_setting[:tool].to_s.size > 0 and
              not I3.config.tools[section_setting[:tool]].nil?
          new_section[:icon] = "/" + section_setting[:tool] + "/client-web/img/applet-icon-32.png"
        else
          new_section[:icon] = "/common/client-web/img/file-types/executable-32.png"
        end #if
        # Add the links to the section.
        section_setting[:links].each do |link_setting|
          if link_setting[:tool].to_s.size > 0
            # This is a link to an i3 tool.
            # Only add the link if the tool exists.
            unless I3.config.tools[link_setting[:tool]].nil?
              linked_tool = I3.config.tools[link_setting[:tool]]
              if linked_tool.is_native?
                # Determine the caption from the tool config if none is supplied.
                link = {
                  :tool => link_setting[:tool],
                  :caption => link_setting[:caption] || linked_tool.name
                }
                link[:path] = link_setting[:path] if link_setting[:path].to_s.size > 0
                new_section[:links] << link
              else
                # This is a non-native tool.  Treat it as a link to an external site.
                link = {
                  :uri => linked_tool.applets["client-web"]["index"].remote_path,
                  :caption => link_setting[:caption] || linked_tool.name
                }
                new_section[:links] << link
              end #if
            end #unless
          elsif link_setting[:uri].to_s.size > 0
            # This is a link to an external site.
            # Use the site hostname as the caption if none is supplied.
            link = { :uri => link_setting[:uri], :caption => link_setting[:caption] }
            link[:caption] ||= URI.parse(link[:uri]).host
            new_section[:links] << link
          end #if
        end #each
        result.link_list << new_section
      end #each

      # Create a default home page if none exists.
      acct = I3.server.remote_account_as(Home::Account)
      if acct.home_page.nil?
        acct.home_page = HomePage.new_with_defaults
        acct.save
        result.first_time = true
        log.info "Home page created for #{acct.account_name}."
      end #if
      home_page = acct.home_page
      
      # Fill in the news.
      home_page.apply_permissions!
      unless home_page.news_topics.empty?
        # Build the news topic array.
        result.news = home_page.news_topics.collect do |topic|
          topic_result = {
            :name => topic.name,
            :is_external => topic.is_external?
          }
          topic_result[:articles] = topic.recent_articles.collect do |article|
            article_result = {
              :subject => article.subject,
              :posted_at => article.posted_at,
            }
            if article.author
              article_result[:author] = article.author.full_name
            else
              article_result[:author] = article.author_name.to_s
            end #if
            if topic.is_external?
              article_result[:uri] = article.external_uri
            else
              article_result[:uri] = '/bboard/data/messages/%s/%s/%s' % [
                topic.permalink,
                article.posted_at.strftime("%Y/%m/%d"),
                article.permalink
              ]
              article_result[:comment_count] = article.comments.size
            end #if
            if article_result[:comment_count].to_i > 0
              article_result[:modified_at] =
                article.comments.last.posted_at
              article_result[:last_contributor] =
                article.comments.last.author.full_name
            else
              article_result[:modified_at] = article_result[:posted_at]
              article_result[:last_contributor] = article_result[:author]
            end #if
            article_result
          end #collect
          topic_result
        end #collect
      end #unless
      
      # Fill in the weather reports.
      unless home_page.weather_reports.empty?
        home_page.weather_reports.each do |report|
          report_result = report.to_shared(:strip_id=>true)
          report_result["forecasts"] = report.forecasts.collect do |fc|
            fc.to_shared(:strip_id=>true)
          end #collect
          result.weather << report_result
        end #each
      end #unless
      
      # Add a helpful tip.
      tip_count = BulletinBoard::Article.count(
        :conditions => "topics.permalink = 'intranet-tips'", :include => "topic")
      if tip_count > 0
        tip_offset = rand(tip_count).floor
        tip = BulletinBoard::Article.find(:all, :conditions => "topics.permalink = 'intranet-tips'", 
          :include => "topic", :offset => tip_offset, :limit => 1).first.text
      else
        tip = "You can add tips by creating a Bulletin Board topic called 'Intranet Tips'!"
      end
      
      result.tip = tip
      return result

    end #def

  end #class

end #module
