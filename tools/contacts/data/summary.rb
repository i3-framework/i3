#
# Web Service: contacts/data/summary
#
# Sends the summary of contact information to the client.
# See <Contacts::Summary> for more information about the summary object.
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
#   $Id: summary.rb 43 2008-01-07 17:58:02Z nmellis $
#

require "contacts/data/model/summary"         # Summary shared object

#
# Module: Contacts
# 
# The module containing all Contacts classes and data.
# 
module Contacts

  #
  # Class: Contacts::SummaryServlet
  # 
  # The main servlet for the Contacts Summary service.
  #
  class SummaryServlet < I3::Servlet

    #
    # Method: on_get
    #
    # Sends the Contacts summary from the cache.  An automated job
    # in <contacts/meta/jobs> caches the data each day.
    #
    # Parameters:
    #   path - additional path data provided in the URI; ignored
    #
    def on_get(path)
      has_recent_cache = false
      if I3.cache.exist? "summary"
        cached_at = I3.cache.get_info("summary").modified_at
        has_recent_cache = true if cached_at > Time.now.yesterday
      end #if
      unless has_recent_cache
        I3.cache["summary"] = Contacts::Summary.new
        cached_at = Time.now
      end #unless
      return I3.server.send_304 if I3.server.client_cached_since? cached_at
      I3.server.send_cached_object("summary", :expires => Time.now + 1.hour)
    end #def
    
  end #class

end #module
