#
# Web Service: home/data/weather-codes
#
# Provides a list of weather.com city codes for a given city.  This is
# used when customizing home pages so that users can enter their own
# city names.
#
# The city is given as the URL following `/home/data/weather-codes/`, for
# example:
# 
# (start example)
#   GET /home/data/weather-codes/London
# (end example)
#
# Weather codes are returned as an array of objects, where each object
# has `code` and `name` properties.  US codes are displayed first (in
# City, ST format), followed by international codes.  Example:
#
# (start example)
#   [
#     { "code": "USAR0340", "name": "London, AR" },
#     { "code": "USKY1090", "name": "London, KY" },
#     { "code": "USOH0520", "name": "London, OH" },
#     { "code": "USTX0788", "name": "London, TX" },
#     { "code": "USWV0443", "name": "London, WV" },
#     { "code": "CAXX0255", "name": "London, Canada" },
#     { "code": "UKXX0085", "name": "London, United Kingdom" }
#   ]
# (end example)
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
#   $Id: weather-codes.rb 71 2008-04-01 00:13:57Z nmellis $
#

require "home/data/include/weather-loader"      # Weather.com support

#
# Module: Home
#
# The module containing all Home Page classes and data.
# 
module Home

  #
  # Class: Home::WeatherLookupServlet
  # 
  # Servlet for looking up weather.com city codes
  #
  class WeatherLookupServlet < I3::Servlet
    
    #
    # Method: on_get
    # 
    # Called when a `GET` request is received.  Sends the accuweather.com
    # code(s) for the city given in the path.
    # 
    # Parameters:
    #   path - the name of the city to look up
    #
    def on_get(path)
      begin
        codes = WeatherLoader.new.lookup_city_code(path[1..-1])
      rescue
        log.error $!
        codes = nil
      end
      I3.server.send_object(codes)
    end #def
    
  end #class

end #module
