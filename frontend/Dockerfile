# Use official Nginx image
FROM nginx:alpine

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy your static files into the nginx html folder
COPY . /usr/share/nginx/html

# Expose port 80 (default)
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

