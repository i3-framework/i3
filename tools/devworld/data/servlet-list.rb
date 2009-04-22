#
# Web Service: devworld/data/servlet-list
# 
# Used by the Developer World applet to display a list of available servlets.
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
#   $Id: servlet-list.rb 2 2007-12-06 00:18:23Z melfstrand $
#

#
# Module: DevWorld
#
# Contains classes and data for the Developer World tool.
#
module DevWorld

  #
  # Class: DevWorld::ServletListServlet
  # 
  # The main servlet for the Servlet List web service.
  #
  class ServletListServlet < I3::Servlet

    #
    # Method: on_get
    # 
    # Traverses the directories in `tools` and sends a list of all
    # discovered web services.
    #
    # Parameters:
    #   path - additional path data provided in the URI; ignored
    #
    def on_get(path)
      
      # Find all servlets and trim off the extension.
      servlets = []
      I3.config.tools.each do |tool_dir, tool|
        servlets += tool.servlets.keys.collect { |servlet_name| "/#{tool_dir}/data/#{servlet_name}" }
      end #each
      
      # Send the list.
      I3.server.send_object(servlets.sort)

    end #def

  end #class

end #module
