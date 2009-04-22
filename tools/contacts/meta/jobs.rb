#
# File: contacts/meta/jobs
# 
# Defines jobs to run on a regular basis.
# 
# Credits:
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
#   $Id: jobs.rb 43 2008-01-07 17:58:02Z nmellis $
# 

require "contacts/data/model/summary"

every_day do
  I3.cache["summary"] = Contacts::Summary.new
end
