# run the node get.js command, first parameter sendt to the script
get:
	node get.js $(filter-out $@,$(MAKECMDGOALS))

# run the node index.js command, first parameter sendt to the script
run:
	node index.js $(filter-out $@,$(MAKECMDGOALS))