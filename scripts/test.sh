#!/bin/sh

repo_name=$1

cd ~/FOX/
cd $repo_name
make test
