#!/bin/sh

repo_name=$1
password=$2

cd ~/FOX/
mkdir $repo_name
cd $repo_name

~/MO/scripts/git_pull.exp $password
