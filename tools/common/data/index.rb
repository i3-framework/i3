#
# Web Service: common/data/index
#
# Generates an HTML document for the client that contains the information
# it needs to begin accessing the intranet.  The exact structure will
# differ based on the client type, but it generally includes the preload
# script and a set of user data, such as the list of available tools, the
# user's preferred navigation bar icons, and so on.
#
# *The __I3_INFO object*
# 
# The user data is provided to the client in the form of a JSON-encoded object
# called `__I3_INFO`.  The intranet framework uses this object to initialize
# the objects it provides to applets.  The `__I3_INFO` object has the following
# properties:
# 
#   server - an object that provides the server `title` and `copyright` strings
#   account_name - the name of the current user's account in the directory service
#   first_name - the current user's first name
#   last_name - the current user's last name
#   full_name - the current user's full name; this may simply be a concatenation
#     of the first and last names, or it may be a custom string, depending on the
#     directory service provider
#   description - the user's descripton in the directory service
#   email - the user's primary e-mail address
#   tools - maps tool names (i.e. the directory name of the tool) to a structure
#     of information about the tool.  Each tool that includes support for the user's
#     client type and that the user is allowed to access has an entry in this list.
#     See below for details.
#   permissions - maps tool names to a set of privileges for each tool.
#     Each set of privileges maps a privilege name to `true` if the user has that
#     privilege for the tool.
#   quicklinks - the set of icons to display in the Quick Links area of the
#     navigation bar.  This contains `fixed` and `user_defined` keys, each of
#     which maps to an array of Quick Link items to display.  See below for
#     details.
# 
# Each tool in the `tools` list is an object with the following
# properties:
# 
#   dir - the directory name of the tool, e.g. "bboard"
#   name - the human-readable tool name, e.g. "Bulletin Board"
#   description - a description of what the tool does, for display
#     when the client lists the tools available to the user
#   applets - a hash that maps the names of the available applets for the user's
#     client type to the latest revisions of their HTML files (see <I3::Tool> for
#     details about applet paths)
# 
# Each item in the `fixed` and `user_defined` lists of the `quicklinks` object
# has the following properties:
# 
#   path - the path to which the client should navigate when the link is
#     clicked, e.g. "/#/candy-store/rocky-road"
#   small_icon - the path of the small (16x16) icon to display for the link,
#     e.g. "/candy-store/client-web/img/candybar-16.png"
#   large_icon - the path of the large (32x32) icon to display for the link,
#     e.g. "/candy-store/client-web/img/candybar-32.png"
#   caption - the label to place below the icon in the navigation bar,
#     e.g. "Rocky Road"
# 
# *Server Configuration*
# 
# The `fixed` list comes from `i3-local/config/server.yml`, which is expected
# to define a "navbar_items" array that contains two keys: "required" and
# "default".  The "required" key should map to an array of items that are
# always included in the navigation bar (i.e. they are not removable by the
# user).  The "default" key should map to an array of items that are included
# by default in the navigation bar for new users, but can be removed.
# 
# In both arrays, the following keys are supported for each
# item:
# 
#   tool - required; the short (directory) name of the tool to which the
#     link should point, e.g. "restaurant"
#   path - optional; the path to which the client should navigate when the
#     link is clicked, e.g. "/#/restaurant/tables/1".  If omitted, the default
#     is the index applet for the tool.
#   icon - optional; the name of the icon that should be displayed for the
#     link, minus the size and extension, e.g. "table".  Relative paths will be
#     resolved inside the tool's "img" folder, while absolute paths will be
#     resolved from the web server root.  If omitted, the default is the tool's
#     icon.
#   caption - optional; the caption to display below the icon.  If omitted,
#     the default is the tool name.
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
#   $Id: index.rb 143 2009-01-29 17:31:13Z nmellis $
#

require "i3-template"                         # I3::Template support
require "common/data/model/person"            # Person/Account data models

#
# Module: I3Common
# Common servlet namespace
#
module I3Common

  #
  # Class: I3Common::IndexServlet
  #
  # Main servlet for the Index web service.
  #
  class IndexServlet < I3::Servlet

    # Constant: TEMPLATE_WEB
    # The path to the HTML template to use for web clients.
    TEMPLATE_WEB = I3.resource("common/data/templates/client-web/index.rhtml")
    
    # Constant: TEMPLATE_WEB_PRELOAD
    # The path to the Objective-JS file to embed in the web client template.
    TEMPLATE_WEB_PRELOAD = I3.resource("common/data/templates/client-web/preload.js")
    
    # Constant: TEMPLATE_UNSUPPORTED
    # The path to the HTML template to use for unsupported clients.
    TEMPLATE_UNSUPPORTED = I3.resource("common/data/templates/client-unsupported/index.rhtml")

    #
    # Method: on_get
    #
    # Determines the user's client type, builds the set of essential
    # user data (personal info, permission list, and navigation bar items),
    # and sends the appropriate index template to the client.
    #
    # Parameters:
    #   path - ignored
    #
    def on_get(path)
      info = build_info_for_user_account(I3.server.remote_account)
      I3.server.send_header(:type => "text/html")
      I3.server.send_bytes(self.build_page_with_info(info))
    end #def

    #
    # Method: build_page_with_info
    # 
    # Builds the index page to be sent to the client.
    # 
    # Parameters:
    #   acct - the <I3::Account> for which the information is being assembled
    # 
    # Returns:
    #   A `String` that can be output to the client.
    # 
    def build_page_with_info(info)
      browser = I3.server.request.params["HTTP_USER_AGENT"].to_s.downcase
      browser_classname = case browser
        when %r'applewebkit/5[23]'  : "i3-browser-webkit"
        when %r'gecko/.*firefox/3'  : "i3-browser-mozilla"
        when %r'gecko/'             : "i3-browser-mozilla i3-browser-legacy"
        when %r'opera'              : false  # "i3-browser-opera" when supported
        when %r'msie 7'             : "i3-browser-ie"
        else ; false
      end #case
      if browser_classname != false
        # Convert the Objective-JS preload script to standard JavaScript.
        preload_script_buffer = StringIO.new
        js_processor = ObjectiveJS::Processor.new
        js_processor.enable_compression
        js_processor.process(File.read(TEMPLATE_WEB_PRELOAD), preload_script_buffer)
        preload_script_buffer.rewind
        # Build the page.
        template = I3::Template.new(TEMPLATE_WEB)
        template["browser_classname"] = browser_classname
        template["i3_info"] = info.to_json
        template["preload_list"] = build_web_preload_list.to_json
        template["preload_script"] = preload_script_buffer.read
        return template.render
      else
        template = I3::Template.new(TEMPLATE_UNSUPPORTED)
        template["client_is_mac"] = (browser =~ %r'macintosh') ? true : false
        return template.render
      end #if
    end #def

    #
    # Method: build_info_for_user_account
    # 
    # Builds the set of user information to be embedded in the index page.
    # 
    # Parameters:
    #   acct - the <I3::Account> for which the information is being assembled
    # 
    # Returns:
    #   An <I3::SharedObject> containing the user information.
    # 
    def build_info_for_user_account(acct)
      
      # Fill in server info.
      info = I3::SharedObject.new
      info.server = {
        :title => I3.config.title,
        :copyright => I3.config.copyright
      }

      # Fill in basic user data.
      person = acct.person
      info.account_name = acct.account_name
      info.first_name = person.first_name
      info.last_name = person.last_name
      info.full_name = person.full_name
      info.description = person.description
      info.email = person.email

      # Build list of accessible tools.
      info.tools = Hash.new
      I3.config.tools.each do |tool_name, tool_info|
        if tool_info.has_info? and (not tool_info.applets["client-web"].nil?) and (
            acct.has_permission?("access-tool", tool_name) or
            acct.has_permission?("develop", "i3-root") )
          info.tools[tool_name] = {
            :dir           => tool_info.dir,
            :name          => tool_info.name,
            :description   => tool_info.description,
            :is_native     => tool_info.is_native?, 
            :is_searchable => tool_info.is_searchable?
          }
          # Build applet => revision hash.
          info.tools[tool_name][:applets] = {}
          tool_info.applets["client-web"].each do |applet_name, applet|
            info.tools[tool_name][:applets][applet_name] = applet.remote_path
          end #each
        end #if
      end #each
      
      # Build list of permissions.  First we find all the permissions
      # that specifically reference the account, then we go through all
      # the group permissions and see which ones apply to the account.
      perms = Hash.new
      acct.permissions.each do |perm|
        perms[perm.tool] = Hash.new if perms[perm.tool].nil?
        perms[perm.tool][perm.privilege] = true
      end #each
      I3::Permission.find_all_by_is_group(true).each do |perm|
        if acct.member_of? perm.group_dn
          perms[perm.tool] = Hash.new if perms[perm.tool].nil?
          perms[perm.tool][perm.privilege] = true
        end #if
      end #each
      info.permissions = perms
      
      # Build navigation bar quick links.
      info.quicklinks = I3::SharedObject.new
      info.quicklinks.fixed = I3.config.required_navbar_items.collect do |item|
        item_tool = item["tool"]
        item_path = item["path"] || ""
        item_path = '/#/%s/%s' % [item_tool, item_path] unless item_path.starts_with?("/")
        item_icon = item["icon"] || "applet-icon"
        item_icon = '/%s/client-web/img/%s' % [item_tool, item_icon] unless item_icon.starts_with?("/")
        { :tool => item_tool,
          :path => item_path,
          :small_icon => "#{item_icon}-16.png",
          :large_icon => "#{item_icon}-32.png",
          :caption => item["caption"] || I3.config.tools[item["tool"]].name
        }
      end #collect
      info.quicklinks.user_defined = I3.preferences.get("quicklinks", :tool => "common")
      if info.quicklinks.user_defined.nil?
        info.quicklinks.user_defined = I3.config.default_navbar_items.collect do |item|
          item_tool = item["tool"]
          item_path = item["path"] || ""
          item_path = '/#/%s/%s' % [item_tool, item_path] unless item_path.starts_with?("/")
          item_icon = item["icon"] || "applet-icon"
          item_icon = '/%s/client-web/img/%s' % [item_tool, item_icon] unless item_icon.starts_with?("/")
          { :tool => item_tool,
            :path => item_path,
            :small_icon => "#{item_icon}-16.png",
            :large_icon => "#{item_icon}-32.png",
            :caption => item["caption"] || I3.config.tools[item["tool"]].name
          }
        end #collect
      end #if

      info
    end #def

    #
    # Method: build_web_preload_list
    # 
    # Builds the list of files that the client needs to load before
    # displaying the page.
    # 
    # The preload list is broken out into sections of `scripts`,
    # `styles`, and `images`.  The `scripts` and `styles` sections
    # are hashes that the preload script refers to directly.
    # The `images` section is simply an array of paths that can
    # be any length.
    # 
    # Returns:
    #   An <I3::SharedObject> containing the lists of files.
    # 
    def build_web_preload_list
      
      # Define common locations.
      script_path = "/common/client-web/js"
      styles_path = "/common/client-web/css"
      images_path = "/common/client-web/img"
      theme_styles_path = "/$theme/client-web/css"
      theme_images_path = "/$theme/client-web/img"

      # Build initial list.
      list = I3::SharedObject.new(
        :scripts => {
          :core => "#{script_path}/i3-core.js",
          :nav => "#{script_path}/i3-nav.js"
        },
        :styles => {
          :core => "#{styles_path}/i3-core.css",
          :theme => "#{theme_styles_path}/i3-theme.css",
          :print => "#{theme_styles_path}/i3-print.css"
        },
        :images => [
          "#{images_path}/navbar-buttons.png"
         ]
      )

      # Add theme images.
      Dir["#{I3.resource(theme_images_path)}/*.{gif,jpg,png}"].each do |img|
        list.images << "#{theme_images_path}/#{File.basename(img)}"
      end #collect
      
      # Assign revision identifiers to JavaScript and CSS files.
      list.scripts.each do |key, path|
        list.scripts[key] = path + "/" + File.mtime(I3.resource(path)).to_i.to_s(16)
      end #each
      list.styles.each do |key, path|
        list.styles[key] = path + "/" + File.mtime(I3.resource(path)).to_i.to_s(16)
      end #each
      
      list
    end #def

  end #class

end #module
