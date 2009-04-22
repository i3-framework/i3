#
# Web Service: common/data/internet-explorer-support
#
# Responds to requests from Internet Explorer to support browser history.
# 
# IE's back/forward buttons do not update properly when the page anchor is
# changed programmatically; they only update when an actual page navigation
# occurs.  To work around this, an invisible IFRAME is used to track browser
# history on IE.  Each time a navigation is performed by the web client code,
# this web service is called with a different path supplied as the query
# string, so that IE registers the change.
# 
# This means that, unlike other browsers, IE must make an additional request
# for each new virtual path.  It is thus recommended that users on high-
# latency connections use a different browser.
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
#   $Id: internet-explorer-support.rb 33 2007-12-27 16:16:39Z melfstrand $
#

#
# Module: I3Common
# Common servlet namespace
#
module I3Common

  #
  # Class: I3Common::IESupportServlet
  #
  # Main servlet for the Internet Explorer Support web service.
  #
  class IESupportServlet < I3::Servlet

    #
    # Method: on_get
    #
    # Sends a small HTML document for IE's history frame.
    #
    # Parameters:
    #   path - ignored
    #
    def on_get(path)
      I3.server.send_header(:type => "text/html")
      I3.server.send_bytes('<html><body><div id="historyPlaceholder"></div></body></html>')
    end #def

  end #class

end #module
