# run the node get.js command, first parameter sendt to the script
get:
	node replicate/get.js $(filter-out $@,$(MAKECMDGOALS))

# run the node index.js command, first parameter sendt to the script
run:
	node replicate/index.js $(filter-out $@,$(MAKECMDGOALS))