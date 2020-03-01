#!/bin/bash

function fatal_error() {
	msg=$1
	echo -e "\e[01;31mERR:\e[0m $1"
	exit -1
}

function warning() {
	msg=$1
	echo -e "\e[01;33mWRN:\e[0m $1"
}

function end_ok() {
	echo -e "\e[01;32mDone !\e[0m"
	exit 0
}