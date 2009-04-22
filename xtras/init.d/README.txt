
Init Scripts
============

This folder contains sample items that can be placed in
/etc/init.d on any standard UNIX or Linux OS.  The paths
may need to be modified to suit your configuration after
being copied.

- i3-mongrel-service:
  Starts the Mongrel service to handle intranet requests.

- i3-jobs-service:
  Runs automated intranet jobs at scheduled intervals
  to update the database and cached objects.  This should
  only be run on installations that have their own databases
  (e.g. the shared development and production servers).

