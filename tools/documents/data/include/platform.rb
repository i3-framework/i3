#
# File: documents/data/include/platform
# 
# Platform-specific functionality for the Documents applet.
#
# The search/description/metadata support in the Documents applet is
# platform-specific.  On Mac OS X, the support for this is built into the
# filesystem (v10.4 and up only), so no additional data store is necessary.
# Other platforms may support part of this functionality or may store
# attributes in a database.
#
# This file determines which platform is currently in use, loads the
# appropriate platform-specific file, and provides a `DocumentPlatform`
# class with static methods for searching and obtaining file metadata.
# If there is no platform-specific file, a generic `DocumentPlatform` will
# be provided that does not implement the functionality.
#
# Additional platforms can be supported by adding implementations to the
# platforms folder and then adding checks for the platform to this file.
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
#   $Id: platform.rb 127 2008-10-27 20:41:10Z nmellis $
#

require "documents/data/include/platforms/base"

#
# Module: Documents
#
# Contains classes and data for the Documents tool.
# 
module Documents
  
  #
  # Class: Documents::DocumentPlatform
  # 
  # Provides methods for searching and obtaining file metadata.
  # See <DocumentPlatformBase> for more information.
  # 
  require "documents/data/include/platforms/linux"
  DocumentPlatform = LinuxDocumentPlatform
  
  # DocumentPlatform = case RUBY_PLATFORM
  #   when /darwin/  # Mac OS X
  #     require "documents/data/include/platforms/darwin"
  #     DarwinDocumentPlatform
  #   when /linux/   # Any Linux
  #     require "documents/data/include/platforms/linux"
  #     LinuxDocumentPlatform
  #   else
  #     DocumentPlatformBase
  # end #case

end #module