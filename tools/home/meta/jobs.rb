#
# File: home/meta/jobs
# 
# Defines jobs to run on a regular basis.
# 
# Credits:
#   Written by Marshall Elfstrand (marshall@vengefulcow.com).
# 
# Copyright / License:
#   Copyright 2009 Mission Aviation Fellowship.
# 
# Version:
#   $Id: jobs.rb 2 2007-12-06 00:18:23Z melfstrand $
# 

require 'bboard/data/include/rss-loader'
require 'home/data/include/weather-loader'

every_hour do
  BulletinBoard::NewsLoader.new.refresh_all
  Home::WeatherLoader.new.refresh_all
end
