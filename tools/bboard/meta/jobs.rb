#
# File: bboard/meta/jobs
# 
# Defines jobs to run on a regular basis.
# 
# Credits:
#   Written by Nathan Mellis (nathan@mellis.us).
# 
# Copyright / License:
#   Copyright 2009 Mission Aviation Fellowship.
# 
# Version:
#   $Id: jobs.rb 70 2008-03-26 16:14:40Z nmellis $
# 

require "bboard/data/model/bboard"
require "bboard/data/include/mail"

# Send out the daily digest message
every_day_at_2200 do 
  date = Time.now.strftime("%Y-%m-%d")
  subscribers = BulletinBoard::SubscriberExtension.find(:all, 
    :conditions => "email_frequency = 'daily_digest'").collect(&:subscriber)

  subscribers.each do |person|
    options = {
      :date => date, 
      :topics => [], 
      :new_articles => {}, 
      :updated_articles => {}
    }

    subscribed_topics = []
    subscribed_articles = []
    person.subscriptions.each do |subscription|
      subscribed_topics << subscription.topic unless subscription.topic.nil?
      subscribed_articles << subscription.article unless subscription.article.nil?
    end #each

    conditions = ["is_deleted = 0 AND DATE_FORMAT(posted_at, '%Y-%m-%d') = ?", date]

    subscribed_topics.each do |topic|
      next unless person.account.can_view_topic?(topic)
      articles = topic.articles.find(:all, :conditions => conditions)
      options[:new_articles][topic.permalink] = articles
      options[:topics] << topic unless options[:topics].include?(topic) or articles.empty?
    end #each

    subscribed_articles.each do |article|
      next unless person.account.can_view_topic?(article.topic)
      if article.comments.count(:all, :conditions => conditions) > 0
        unless options[:new_articles][article.topic.permalink].to_a.include?(article)
          options[:topics] << article.topic unless options[:topics].include?(article.topic)
          (options[:updated_articles][article.topic.permalink] ||= []) << article
        end #unless
      end #if
    end #each
    
    unless options[:topics].empty?
      BulletinBoard::Mailer.deliver_daily_digest(person.email, options, person.email_format)
    end #unless
  end #each
end #every_day