#
# Web Service: home/data/settings
#
# Provides and updates the configuration data for the user's home page.
# 
# When a `GET` request is sent, an object is returned that contains
# two arrays: `news` and `weather`.  The `news` array contains a list
# of news topics, each of which has a `name`, a `permalink`, an `is_external`
# value (`true` if the topic is an external RSS feed, `false` if it comes
# from the intranet bulletin board), an `is_locked` value (`true` if the
# user is not allowed to remove it from the home page), and a `subscribed`
# value telling whether the user has added it to his or her home page.  The
# `weather` array will contain the list of cities that the user has added
# to his or her list of reports; each city will have `name` and `code` fields.
# 
# When a `POST` request is sent, the posted data should be a JSON-encoded
# object containing `news` and `weather` attributes.  The `news` attribute
# should simply be an array of topic permalinks in the order that the user
# wishes them to appear.  The `weather` attribute should be an array of
# objects, each of which has `code` and `name` attributes, similar to the
# way the weather objects are sent by the server when a `GET` request is made.
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
#   $Id: settings.rb 77 2008-04-02 21:20:49Z nmellis $
#

require "home/data/model/home-page"             # HomePage data model
require "home/data/include/weather-loader"      # Weather.com support

#
# Module: Home
#
# The module containing all Home Page classes and data.
# 
module Home

  #
  # Class: Home::SettingsServlet
  # 
  # Home Page settings servlet
  #
  class SettingsServlet < I3::Servlet

    #
    # Method: on_get
    # 
    # Called when a `GET` request is received.  Sends the user's current
    # home page settings.
    # 
    # Parameters:
    #   path - additional path data provided in the URI; ignored
    #
    def on_get(path)
      I3.server.send_object(retrieve_settings)
    end #def
    
    #
    # Method: on_post
    # 
    # Called when a `POST` request is received.
    # Updates the home page settings with a set of new ones.
    # 
    # Parameters:
    #   path - additional path data provided in the URI; ignored
    #
    def on_post(path)
      response = I3::SharedObject.new
      begin
        save_settings(I3.server.receive_object)
        response.status = "OK"
        response.message = "Home page saved successfully."
      rescue
        log.error $!.to_s
        log.error $!.backtrace.join("\n")
        response.status = "ERROR"
        response.message =
          "Home page could not be saved.  Please contact the Help Desk."
      end
      I3.server.send_object(response)
    end #def

    #
    # Method: retrieve_settings
    # 
    # Loads the Home Page settings for the current user.
    # 
    # Returns:
    #   An <I3::SharedObject> containing `news` and `weather` properties.
    #
    def retrieve_settings

      # Create the result base.
      result = I3::SharedObject.new
      result.news = []
      result.weather = []

      # Get the page data.
      acct = I3.server.remote_account_as(Home::Account)
      home_page = acct.home_page

      # Fill in the subscribed news.
      subscribed_keys = Hash.new
      home_page.apply_permissions!
      unless home_page.news_topics.nil?
        home_page.news_topics.each do |topic|
          subscribed_keys[topic.permalink] = true
          result.news << {
            "name" => topic.name,
            "permalink" => topic.permalink,
            "is_external" => topic.is_external?,
            "is_locked" => topic.is_locked?,
            "subscribed" => true
          }
        end #each
      end #unless
      
      # Add topics that the user hasn't subscribed to.
      bb_acct = BulletinBoard::Account.find(acct.id)
      bb_acct.viewable_topics.each do |topic|
        unless subscribed_keys.has_key? topic.permalink
          # Don't include the "Intranet Tips" topic since it is already displayed under 
          # "Did You Know?"
          next if topic.permalink == "intranet-tips"
          result.news << {
            "name" => topic.name,
            "permalink" => topic.permalink,
            "is_external" => topic.is_external?,
            "is_locked" => topic.is_locked?,
            "subscribed" => false
          }
        end #unless
      end #if
      
      # Fill in the weather reports.
      unless home_page.weather_reports.nil?
        home_page.weather_reports.each do |report|
          result.weather << {
            "code" => report.city_code,
            "name" => report.city_name
          }
        end #each
      end #unless
      
      return result

    end #def

    #
    # Method: save_settings
    # 
    # Saves the given home page `settings` for the current user.
    #
    def save_settings(settings)

      acct = I3.server.remote_account_as(Home::Account)
      
      # Find the news topics and weather reports referenced by the
      # submitted data.
      new_topics = []
      new_reports = []
      bb_acct = BulletinBoard::Account.find(acct.id)
      settings.news.each do |key|
        topic = BulletinBoard::Topic.find_by_permalink(key)
        raise "News topic '#{key}' not found." if topic == nil
        unless bb_acct.can_view_topic?(topic)
          raise 'User "%s" attempted to add unauthorized topic "%s".' %
                [bb_acct.account_name, topic.permalink]
        end #unless
        new_topics << topic
      end #each
      settings.weather.each do |item|
        report = WeatherReport.find_by_city_code(item.code)
        if report.nil?
          report = WeatherReport.new
          report.city_code = item.code
          report.save
          WeatherLoader.new.refresh_report(report)
          log.info(
            'Added weather report for "%s" (%s)' % [item.name, item.code] )
        end #if
        new_reports << report
      end #each

      # Assuming we got this far, we can replace the existing home
      # page items with the new ones.
      home_page = acct.home_page
      home_page.replace_news_topics(new_topics)
      home_page.replace_weather_reports(new_reports)
      home_page.save

      # Remove orphaned weather reports.
      begin
        orphans = WeatherReport.remove_orphans
      rescue
        log.error $!.to_s
      end

    end #def

  end #class

end #module
