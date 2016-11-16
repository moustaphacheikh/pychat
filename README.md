![python](https://img.shields.io/badge/python-2.7%2C%203.x-blue.svg) ![python](https://img.shields.io/badge/django-1.7--1.9-blue.svg) [![Scrutinizer Build pass](https://scrutinizer-ci.com/g/Deathangel908/djangochat/badges/build.png)](https://scrutinizer-ci.com/g/Deathangel908/djangochat) [![Scrutinizer Code Quality](https://scrutinizer-ci.com/g/Deathangel908/djangochat/badges/quality-score.png?b=master)](https://scrutinizer-ci.com/g/Deathangel908/djangochat/?branch=master) [![Code Health](https://landscape.io/github/Deathangel908/djangochat/master/landscape.svg?style=flat)](https://landscape.io/github/Deathangel908/djangochat/master) [![Codacy Badge](https://www.codacy.com/project/badge/b508fef8efba4a5f8b5e8411c0803af5)](https://www.codacy.com/public/nightmarequake/djangochat)

What is it?
==============
This is free web (browser) chat. It allows users send instant text messages or images, make video/audio calls, send files and other useful stuff.

How it works?
==============
Chat is written in **Python** with [django](https://www.djangoproject.com/). For handling realtime messages [WebSockets](https://en.wikipedia.org/wiki/WebSocket) are used: browser support on client part and asynchronous framework [Tornado](http://www.tornadoweb.org/) on server part. Messages are being broadcast by means of [redis](http://redis.io/) [pub/sub](http://en.wikipedia.org/wiki/Publish%E2%80%93subscribe_pattern) feature using [tornado-redis](https://github.com/leporo/tornado-redis) backend. Redis is also used as django session backend and for storing current users online.  For video call [webrtc](https://webrtc.org/) technology was used with stun server to make a connection, which means you will always get the lowest ping and the best possible connection channel. Client part doesn't use any javascript frameworks (like jquery or datatables) in order to get best performance. Chat written as a singlePage application, so even if user navigates across different pages websocket connection doesn't break. Css is compiled from [sass](http://sass-lang.com/guide). Server side can be run on any platform **Windows**, **Linux**, **Mac** with **Python 2.7** and **Python 3.x**. Client (users) can use the chat from any browser with websocket support: IE11, Edge, Chrome, Firefox, Android, Opera, Safari...

[Live demo](http://pychat.org/)
================

Setup instructions for Archlinux:
================================

Though ArchLinux is not recommended as a server OS I prefer using it over other stable ones.
  
Prepare system.
 0. Passwordless login to ssh server (optional): run this from client `cat ~/.ssh/id_rsa.pub | ssh -p 666 root@ip 'mkdir -p .ssh; cat >> .ssh/authorized_keys'`
 0. Install packages `pacman -S  git nginx python python-pip redis mariadb mysql-python python-mysql-connector postfix ruby gcc jansson`. You surely can install `uwsgi` and `uwsgi-plugin-python` via pacman but I found pip's package more stable so `pip install uwsgi`. Also you need to install sass, you can do it via aur `yaourt -S ruby-sass` or gem: `gem install sass` (don't forget to add `sass` to `PATH` variable if you install it via gem: `export PATH="$PATH:$(ls ~/.gem/ruby/*/bin/ -d)"`)
 0. Clone project to local filesystem (I would recommend to clone it into `/srv/http` directory): `git clone https://github.com/Deathangel908/djangochat`. Further instructions assume that working directory is project root, so `cd djangochat`. And change the branch: `git checkout -b prod_archlinux origin/prod_archlinux`
 0. If you cloned project into different directory than `/srv/http` you need to replace all absolute paths for your one in config files `pattern="/srv/http"; grep -rl "$pattern" ./rootfs |xargs sed -i "s#$pattern#$PWD#g"` 
 0. Replace all occurrences of domain name `exist_domain="pychat\.org"; your_domain="YOUR\.DOMAIN\.COM"; grep -rl "$exist_domain" ./ |xargs sed -i "s#$exist_domain#$your_domain#g"`. (note regex escape for dot char) Change `STATIC_URL` to `/static/` and `MEDIA_URL` to `/photo/` in `chat/settings.py`. Also check `rootfs/etc/nginx/nginx.conf` you may want to merge `location /photo` and `location /static` into main `server` conf. (you need all of this because I used subdomain for static urls)
 0  Copy config files to rootfs `cp rootfs / -r `. Change owner of project to `http` user: `chown -R http:http`. And reload systemd config `systemctl daemon-reload`. 
 0  Generate postfix postman: `postmap /etc/postfix/virtual; postman /etc/aliases`
 0. Add file `chat/production.py`, place there `SECRET_KEY` and optional: `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`, `GOOGLE_OAUTH_2_CLIENT_ID`, `FACEBOOK_ACCESS_TOKEN`, `FACEBOOK_APP_ID`.  
 0. If you just installed mariadb you need to initialize it: `mysql_install_db --user=mysql --basedir=/usr --datadir=/var/lib/mysql`. Start mysql `systemctl start mysqld` and create database `echo "create database django CHARACTER SET utf8 COLLATE utf8_general_ci" | mysql`
 0. Optional: add services to autostart  `packages=( mysqld  redis uwsgi tornado nginx postfix ) ; for package in "${packages[@]}" ; do systemctl enable $package; done;`
 0. Get all dependencies `pip install -r requirements.txt`
 0. Fill database with tables `python manage.py init_db`
 0. Download static content `sh download_content.sh`
 0. Place your certificate in `/etc/nginx/ssl`, you can get free one with startssl. For it start postfix service, send validation email to domain `webmaster@pychat.org` and apply verification code from `/root/Maildir/new/<<time>>` (you may also need to  disable ssl in /etc/postfix/main.cf since it's enabled by default). You can generate server.key and get certificate from  https://www.startssl.com/Certificates/ApplySSLCert . Put them into  `/etc/nginx/ssl/server.key` and `/etc/nginx/ssl/1_${YOUR.DOMAIN.COM}_bundle.crt` (`YOUR.DOMAIN.COM` = `pychat.org` by default, but replaced above) (those settings are listed in `nginx.conf` and `settings.py`). (you can also create your own certificate or copy them from `/usr/lib/python*/site-packages/sslserver/certs/`). Don't forget to change owner of files to http user `chown -R http:http /etc/nginx/ssl/`
 0. Add django admin static files: `python manage.py collectstatic`
 0. I use 2 git repos in 2 project directory. So you probably need to rename `excludeMAIN`file to `.gitignore`or create link to exclude. `ln -rsf .excludeMAIN .git/info/exclude`

Start the chat:
 1. Start session holder: `systemctl start redis`
 1. Run server: `systemctl start  nginx`
 1. Start email server `systemctl start postfix`
 1. Start database: `systemctl start mysqld`
 1. Start the Chat: `systemctl start uwsgi`
 1. Start the WebSocket listener: `systemctl start tornado`
 1. Open in browser [http**s**://your.domain.com](https://127.0.0.1). Note that by default nginx listens no by ip address but by domain.name
 1. If something doesn't work you want to check `djangochat/logs` directory. If there's no logs in directory you may want to check service stdout: `sudo journalctl -u YOUR_SERVICE`. Check that user `http` has access to you project directory.

# TODO
* add tornado sinle log file instead of 1 per port, add port param to it
* webrtc connection lost while transfering file causes js error
* Add title for room. 
* add scale to painter and Ctrl+Z
* Show online status right of Direct user's messages besides channels' online 
* TODO if someone offers a new call till establishing connection for a call self.call_receiver_channel would be set to wrong
* !!!IMPORTANT Debug call dialog by switching channels while calling and no.
* shape-inside for contentteditable 
* Colored print in download_content.sh
* Add multi-language support. 
* Move clear cache icon from nav to settings
* add email confirmation for username or password change
* remember if user has camera/mic and autoset values after second call
* android play() can only be initiated by a user gesture.
* insecure images on usermessage editable div prevent sending messages
* add 404page
* https://code.djangoproject.com/ticket/25489
* http://stackoverflow.com/a/18843553/3872976
* add antispam system
* add http://www.amcharts.com/download/ to chart spam or user s  tatistic info
* startup loading messages in a separate thread (JS )
* move loading messages on startup to single function? 
* add antiflood settings to nginx
* tornado redis connection reset prevents user from deleting its entry in online_users
* run tornado via nginx http://tornado.readthedocs.org/en/latest/guide/running.html
* fixme tornado logs messages to chat.log when messages don't belong to tornadoapp.p
* add media query for register and usersettings to adjust for phone's width
* add change password and realtime javascript to change_profile
* file upload http://stackoverflow.com/a/14605593/3872976
* add periodic refresh user task -> runs every N hours. publish message to online channel, gets all usernames in N seconds, then edits connection in redis http://michal.karzynski.pl/blog/2014/05/18/setting-up-an-asynchronous-task-queue-for-django-using-celery-redis/ 
