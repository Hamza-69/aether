#!/usr/bin/expect -f

set timeout 120

spawn npx -y @react-native-reusables/cli@0.7.1 init -t minimal

expect "What is the name of your project?"
send "frontend\r"

expect "Would you like to install dependencies?"
send "y\r"

expect "Which package manager"
send "\033\[B"
send "\033\[B"
send "\r"

expect "Git"
send "y\r"

expect eof