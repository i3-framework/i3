#
# Web Service: devworld/data/cgi-vars
# 
# Sends a list of all of the available CGI environment variables with their
# values.  This is helpful when writing new web services to get an idea of
# what environment values are available to the service.  All four standard
# HTTP methods used in i3 are supported.
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
#   $Id: cgi-vars.rb 2 2007-12-06 00:18:23Z melfstrand $
#

#
# Module: DevWorld
#
# Contains classes and data for the Developer World tool.
#
module DevWorld

  #
  # Class: DevWorld::CGIVarsServlet
  # 
  # The main servlet for the CGI Variables web service.
  #
  class CGIVarsServlet < I3::Servlet

    #
    # Method: on_get
    # 
    # Sends the CGI environment variables.
    # 
    # Parameters:
    #   path - additional path data provided in the URI
    # 
    # See Also:
    #   <DevWorld::CGIVarsServlet::send_response>
    #
    def on_get(path)
      send_response
    end #def

    #
    # Method: on_post
    # 
    # Sends the CGI environment variables along with the posted data
    # and the i3 framework's interpretation of the data.
    # 
    # Parameters:
    #   path - additional path data provided in the URI
    # 
    # See Also:
    #   <DevWorld::CGIVarsServlet::send_extended_response>
    #
    def on_post(path)
      send_extended_response
    end #def

    #
    # Method: on_put
    # 
    # Sends the CGI environment variables along with the posted data
    # and the i3 framework's interpretation of the data.
    # 
    # Parameters:
    #   path - additional path data provided in the URI
    # 
    # See Also:
    #   <DevWorld::CGIVarsServlet::send_extended_response>
    #
    def on_put(path)
      send_extended_response
    end #def

    #
    # Method: on_delete
    # 
    # Sends the CGI environment variables.
    # 
    # Parameters:
    #   path - additional path data provided in the URI
    # 
    # See Also:
    #   <DevWorld::CGIVarsServlet::send_response>
    #
    def on_delete(path)
      send_response
    end #def

    #
    # Method: send_response
    # 
    # Constructs and sends an object containing the CGI environment variables.
    # This method is called by `on_get` and `on_delete` to do the actual work
    # of sending the data.
    # 
    # The sent object will have a single property called `environment`,
    # which will be a hash of CGI variable names and their values.
    #
    def send_response
      I3.server.send_object({"environment" => I3.server.request.params})
    end #def
    
    #
    # Method: send_extended_response
    # 
    # Constructs and sends an object containing the CGI environment variables,
    # the post data, and some additional fields.  This method is called by
    # `on_post` and `on_put` to do the actual work of sending the data.
    # 
    # The sent object will have the following
    # fields:
    # 
    #   environment - the CGI environment variables (same as would be
    #     sent by <DevWorld::CGIVarsServlet::send_response>)
    #   method_list - the array of method names supported by the
    #     `I3.server.cgi` object
    #   post_data - the data posted by the client
    #   content_length - the size of the posted data in bytes
    #   interpreted_post_data - the posted data converted to an
    #     <I3::SharedObject> instance (and, when the client receives it,
    #     re-encoded in JSON format)
    #
    def send_extended_response
      response = I3::SharedObject.new
      response.environment = I3.server.request.params
      response.post_data = I3.server.request.body.string
      response.interpreted_post_data = I3.server.receive_object
      I3.server.send_object(response)
    end #def

  end #class

end #module
