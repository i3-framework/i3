#
# File: home/data/model/weather
# 
# Defines the data model for the weather reports that are displayed
# on user home pages.
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
#   $Id: weather.rb 8 2007-12-06 23:26:49Z melfstrand $
#

#
# Module: Home
#
# The module containing all Home Page classes and data.
# 
module Home
  
# SQL query for finding orphaned weather reports.
WEATHER_ORPHANS_SQL =<<EOS
  SELECT
    id, city_code, city_name
  FROM
    weather_reports AS wr
    LEFT JOIN home_pages_weather_reports AS hpwr
      ON wr.id = hpwr.weather_report_id
  WHERE
    hpwr.weather_report_id IS NULL
EOS

  #
  # Data Model: Home::WeatherReport
  # 
  # Represents a weather report for a single city.
  #
  class WeatherReport < I3::Record
    has_many :forecasts, :class_name => "WeatherForecast",
             :order => "date", :dependent => :destroy
    
    #
    # Removes weather reports that do not belong to a home page.
    #
    def self.remove_orphans
      orphaned_reports = WeatherReport.find_by_sql WEATHER_ORPHANS_SQL
      orphaned_reports.each do |report|
        I3::log.info(self.name) do
          'Removing orphaned weather report for "%s" (%s)' %
          [report.city_name, report.city_code]
        end #log.info
        report.destroy
      end #each
    end #def

  end #class
  
  #
  # Data Model: Home::WeatherForecast
  #
  # Represents a day of the forecast data.
  #
  class WeatherForecast < I3::Record
  end #class

end #module
