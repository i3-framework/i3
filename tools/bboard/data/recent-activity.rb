#
# Web Service: bboard/data/recent-activity
#
# Provides a list of recently updated articles, which is used on the
# main Bulletin Board page to provide an overview.
#
# The service will provide an array of activity objects, sorted by most
# recent.  Each object will have a `subject`, a `modified_at` time, a
# `comment_count`, a `uri` for retrieving the article, the article's
# `author` (full name string), and a `last_contributor` field containing
# the full name of the person who last commented on the article (or the
# original author if no comments have been posted).
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
#   $Id: recent-activity.rb 8 2007-12-06 23:26:49Z melfstrand $
#

require "bboard/data/model/bboard"              # Bulletin Board data model

#
# Module: BulletinBoard
#
# The module containing all Bulletin Board classes and data.
#
module BulletinBoard

  #
  # Class: BulletinBoard::RecentActivityServlet
  # 
  # Servlet that provides a list of recent bulletin board articles.
  #
  class RecentActivityServlet < I3::Servlet

    # Constant: MAX_ARTICLES
    # Maximum number of articles to return.
    MAX_ARTICLES = 20

    #
    # Method: on_get
    # 
    # Provides the list of recent articles.
    # 
    # Parameters:
    #   path - additional path data provided in the URI; ignored
    #
    def on_get(path)
      topics = I3.server.remote_account_as(Account).viewable_topics
      articles = Article.find_recent(MAX_ARTICLES, topics).collect do |article|
        item = I3::SharedObject.new
        if article.comments.count > 0
          item.modified_at = article.comments.last.posted_at
          item.last_contributor = article.comments.last.author.full_name
        else
          item.modified_at = article.posted_at
          item.last_contributor = article.author.full_name
        end #if
        item.author = article.author.full_name
        item.subject = article.subject
        item.uri = '/bboard/data/messages/%s/%s/%s' % [
          article.topic.permalink,
          article.posted_at.strftime("%Y/%m/%d"),
          article.permalink
        ]
        item.comment_count = article.comments.count
        item
      end #collect
      I3.server.send_object(articles)
    end #def

  end #class

end #module
