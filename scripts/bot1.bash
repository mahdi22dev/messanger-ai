#!/usr/bin/env bash
xvfb-run --auto-servernum --server-num=1 \
  --server-args='-screen 0, 1920x1080x24' node traffic.js 2 https://countmytimee.site &
xvfb-run --auto-servernum --server-num=1 \
  --server-args='-screen 0, 1920x1080x24' node traffic.js 3 https://healthybmi.site &
xvfb-run --auto-servernum --server-num=1 \
  --server-args='-screen 0, 1920x1080x24' node traffic.js 1 https://test.techascend.site &
wait
