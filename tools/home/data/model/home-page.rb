#
# File: home/data/model/home-page
#
# Defines the data models for the home page tool.  This includes the
# <Home::HomePage> object and extensions to the <I3::Account> object.
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
#   $Id: home-page.rb 8 2007-12-06 23:26:49Z melfstrand $
#

require "common/data/model/person"           # Person/Account data models
require "bboard/data/model/bboard"           # Bulletin board data model
require "home/data/model/weather"            # Weather report data model

#
# Module: Home
#
# The module containing all Home Page classes and data.
# 
module Home

  #
  # Data Model: Home::Account
  #
  # Extends the intranet user account model with the `home_page` attribute.
  #
  class Account < I3::Account
    has_one :home_page
  end #class


  #
  # Data Model: Home::HomePage
  # 
  # Provides access to a user's home page settings, including subscribed
  # news topics and weather reports.
  #
  class HomePage < I3::Record
    belongs_to :account
    has_many :news_topic_associations, :dependent => :destroy
    has_many :news_topics,
             :through => :news_topic_associations,
             :order => "position"
    has_many :weather_report_associations, :dependent => :destroy
    has_many :weather_reports,
             :through => :weather_report_associations,
             :order => "position"

    #
    # Method: apply_permissions
    #
    # Ensures that the Bulletin Board topics associated with this home
    # page only include those that the user has permission to view.
    #
    def apply_permissions!
      if self.news_topics
        acct = BulletinBoard::Account.find(self.account.id)
        invalid_associations = self.news_topic_associations.reject do |assoc|
          acct.can_view_topic?(assoc.news_topic)
        end #reject
        if invalid_associations.size > 0
          self.news_topic_associations.delete(invalid_associations)
          self.news_topics(true)  # force reload
        end #unless
      end #unless
      true
    end

    #
    # Method: replace_news_topics
    # 
    # Replaces the Bulletin Board topics associated with this home page
    # with a new list.
    # 
    # Parameters:
    #   topics - an Array of <BulletinBoard::Topic> objects
    # 
    def replace_news_topics(topics)
      news_topic_associations.delete news_topic_associations
      topics.each do |t|
        news_topic_associations << NewsTopicAssociation.for_topic(t)
      end #each
    end #def
    
    #
    # Method: replace_weather_reports
    # 
    # Replaces the weather reports associated with this home page
    # with a new list.
    # 
    # Parameters:
    #   reports - an Array of <Home::WeatherReport> objects
    # 
    def replace_weather_reports(reports)
      weather_report_associations.delete weather_report_associations
      reports.each do |r|
        weather_report_associations << WeatherReportAssociation.for_report(r)
      end #each
    end #def
    
    #
    # Class Method: new_with_defaults
    # 
    # Creates a home page with default settings.
    # 
    # Returns:
    #   A <HomePage> object initialized with the default set
    #   of news and weather options.
    #
    # See Also:
    #   The <NEWS_DEFAULTS> and <WEATHER_DEFAULTS> constants.
    # 
    def self.new_with_defaults
      news_defaults = I3.config.tools["home"].settings.defaults.news || []
      weather_defaults = I3.config.tools["home"].settings.defaults.weather || []
      topics = news_defaults.collect do |name|
        BulletinBoard::Topic.find_by_permalink(name)
      end #collect
      reports = weather_defaults.collect do |code|
        WeatherReport.find_by_city_code(code)
      end #each
      hp = self.new
      hp.replace_news_topics(topics)
      hp.replace_weather_reports(reports)
      return hp
    end #def
    
  end #class
  

  #
  # Data Model: Home::NewsTopicAssociation
  # 
  # Represents a link between a home page and a Bulletin Board topic.
  # This has to be explicitly modeled because we are using it as a
  # list to order the topics on the home page.
  #
  class NewsTopicAssociation < I3::Record
    set_table_name "home_pages_bboard_topics"
    set_primary_key "association_id"
    belongs_to :home_page
    belongs_to :news_topic, :foreign_key => "topic_id",
               :class_name => "BulletinBoard::Topic"
    acts_as_list :scope => :home_page
    
    #
    # Class Method: for_topic
    # 
    # Creates a home page assocation for the given Bulletin Board topic.
    # 
    # Parameters:
    #   topic - the <BulletinBoard::Topic> to associate
    # 
    # Returns:
    #   An initialized <NewsTopicAssociation> that can be assigned
    #   to a home page's `news_topic_associations` collection.
    # 
    def self.for_topic(topic)
      assoc = self.new
      assoc.news_topic = topic
      return assoc
    end #def
  end #class


  #
  # Data Model: Home::WeatherReportAssociation
  # 
  # Represents a link between a home page and a weather report.
  # This has to be explicitly modeled because we are using it as a
  # list to order the reports on the home page.
  #
  class WeatherReportAssociation < I3::Record
    set_table_name "home_pages_weather_reports"
    set_primary_key "association_id"
    belongs_to :home_page
    belongs_to :weather_report
    acts_as_list :scope => :home_page

    #
    # Class Method: for_report
    # 
    # Creates a home page assocation for the given weather report.
    # 
    # Parameters:
    #   topic - the <Home::WeatherReport> to associate
    # 
    # Returns:
    #   An initialized <WeatherReportAssociation> that can be assigned
    #   to a home page's `weather_report_associations` collection.
    # 
    def self.for_report(report)
      assoc = self.new
      assoc.weather_report = report
      return assoc
    end #def
  end #class
  
end #module
