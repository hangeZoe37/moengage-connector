# 🚀 How to Deploy Your Application (Step-by-Step for the Server)

When your PM gives you the server, here is what needs to happen to get this code running on it. Think of the server as a blank, brand-new computer that stays turned on 24/7.

---

## 1. Get the "Keys" from your PM
Before starting, ask your PM for:
- **Server IP address** (e.g., `192.168.1.50`)
- **Username & Password** (to log into the server)
- **Domain Name** (e.g., `connector.yourcompany.com` - so SPARC and MoEngage can talk to it)

## 2. Log into the Server
You will open up PowerShell on your Windows laptop and "log in" to that new computer using a command like:
`ssh username@server_ip_address`
(It will ask for the password your PM gave you).

## 3. Install the Required Programs (The "Furniture")
Since it's a completely blank computer, we have to teach it how to read your code. We will type some commands to install:
- **Node.js** (to run the backend code)
- **MySQL** (to store the data)
- **Nginx** (to link your domain name to your app)
- **PM2** (a program that makes sure your app stays turned on, even if it crashes)

## 4. Move Your Code to the Server
We need to copy the code from your laptop to the new server. 
We can either zip your project folder here and send it over, or download it straight from GitHub onto the server.

## 5. Set up the Database
We will log into MySQL on the server, create a database called `sparc_moengage`, and run your `migrations/final_schema.sql` file. This creates all the tables you made (like `clients`, `message_logs`, etc.).

## 6. Configure the Passwords (The `.env` file)
Your `.env` file doesn't go to the new server securely on its own. We will create a fresh `.env` file on the server and type in all the live passwords, database details, and MoEngage keys.

## 7. Turn it On 
We will type a command to build your dashboard (`npm run build`) and start your backend program (`pm2 start server.js`). 
At this point, your app is officially running on the internet!

## 8. Link the Domain Name
We configure `Nginx` (the traffic cop) to say: "Any time someone visits `connector.yourcompany.com`, send them to our running Node app." We will also add a free security certificate so it uses `HTTPS`.

## 9. Register with SPARC and MoEngage
Finally, you take your shiny new domain (e.g., `https://connector.yourcompany.com/sparc/dlr`) and give that to the SPARC team so they know where to send messages. You do the same for MoEngage!

---

**Don't worry about memorizing the exact terminal commands yet.** 
When the PM hands you the server details, you can come back here, share the details with me, and I will guide you through the exact terminal commands to type, one by one.
