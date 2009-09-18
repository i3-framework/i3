#
# File: framework/intranet/json
#
# Implements JSON encoders for `Object` and `Time` values.
#
# ActiveSupport (part of Rails) provides basic JSON support for most
# of the common Ruby types.  However, the default representation for
# `Object` values (i.e. those with no encoder of their own) attempts
# to encode all instance values, which can lead to circular references.
# This file redefines the `Object` encoder to simply return its string
# representation (obtained via `to_s`).
#
# An encoder has been supplied for the `Time` class that returns the string
# representation of the time in RFC 2616 format (UTC).  This can be parsed
# by the JavaScript date-handling functions.  Since there is no way to inform
# the client that it is a date (in a language-independent manner), the client
# will need to know which fields are meant to be date/time values and convert
# them appropriately.
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
#   $Id: json.rb 138 2008-12-02 18:10:26Z nmellis $
#

require "time"
require "active_support"

begin
  require "json/ext"
rescue LoadError
  include I3::LoggingSupport
  log.info "JSON encoder can't find C extension.  Using pure ruby version."
  require "json/pure"
end

require "json/add/rails"

class Object
  def to_json(options = nil)
    if self.respond_to?(:to_shared)
      self.to_shared.to_json(options)
    else
      self.to_s.to_json(options)
    end
  end #to_json
end #class Object

class Time
  def to_json(options = nil)
    self.httpdate.to_json(options)
  end #to_json
end #class Time

class Date
  def to_json(options = nil)
    self.strftime("%d %b %Y").to_json(options)
  end #to_json
end #class Date
