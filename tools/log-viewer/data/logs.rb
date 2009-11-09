#
# Web Service: log-viewer/data/logs
#
# Place a description for your web service here.
#
# Credits:
# 
#   Written by Nathan Mellis.
# 
# Copyright / License:
# 
#   Copyright 2008 Mission Aviation Fellowship
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
#   $Id: logs.rb 1639 2008-08-18 17:42:48Z nmellis $
#

require "log-viewer/data/model/logs"

#
# Module: LogViewer
#
# The module containing all Log Viewer classes and data.
#
module LogViewer

  #
  # Class: LogViewer::LogsServlet
  #
  # The main servlet for the Logs service.
  #
  class LogsServlet < I3::Servlet
    
    #
    # Method: on_get
    #
    # Returns a greeting.
    #
    # Parameters:
    #   path - additional path data provided in the URI
    #
    def on_get(path)
      path = path[1..-1] if path.starts_with?("/")
      path = path.split("/")
      
      if path[0]
        service_name = path[0]
        service = Service.new(service_name)
        
        unless service.is_accessible_by_account?(I3.server.remote_account)
          raise I3::SecurityException.new
        end #unless
        
        I3.server.send_object service
      else
        services = Service.find_by_account(I3.server.remote_account)
        I3.server.send_object services
      end #if
    end #def

  end #class

end #module
