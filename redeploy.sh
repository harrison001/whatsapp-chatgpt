#!/bin/bash

#shut down the running dockers
docker-compose down

# Set the repository and tag you want to delete
repository="my-whatsapp-bot"
tag="latest"

# Get the image ID of the specified repository and tag
image_id=$(docker images | grep "$repository" | grep "$tag" | awk '{print $3}')

# Check if the image ID is not empty
if [ -n "$image_id" ]; then
    # Delete the image with the specified image ID
    docker rmi $image_id
else
    echo "Image not found for repository: $repository and tag: $tag"
fi

#rebuild 
docker build -t my-whatsapp-bot:latest .

#start
docker-compose up
