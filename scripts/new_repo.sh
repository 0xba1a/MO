#!/bin/sh

repo_name=$1
password=$2
github_url="git@github.com:l-fox/${repo_name}.git"

echo $github_url
echo $password

cd ~/FOX/
mkdir $repo_name
cd $repo_name

echo "# ${repo_name}" >> README.md
git init

git config --local user.name "l-fox"
git config --local user.email "kumaran127@gmail.com"

git add README.md
git commit -m "First commit by Fox"
git remote add origin $github_url
~/MO/scripts/git_push.exp $password
