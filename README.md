# Botie-Backend

A comprehensive Node.js backend API for task management with user authentication, customer management, and Twilio integration.

## 🚀 Features

- **User Authentication & Authorization**
  - JWT-based authentication
  - Email verification system
  - Password reset functionality
  - Soft delete for user accounts

- **Task Management**
  - Create, read, update, delete tasks
  - Task status tracking (resolved/unresolved)
  - Soft delete functionality
  - Pagination and search capabilities

- **Customer Management**
  - Customer CRUD operations
  - Search customers by name or phone number
  - User-specific customer isolation
  - Soft delete functionality

- **Twilio Integration**
  - Automatic phone number assignment to users
  - Phone number management and cleanup

- **Data Security**
  - Soft delete for all entities
  - User data isolation
  - Input validation and sanitization

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Twilio account (for phone number features)
- Email service (for verification emails)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Botie-Backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # MongoDB Configuration
   MONGO_URI=mongodb://localhost:27017/botie-backend

   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key

   # Email Configuration (for verification emails)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password

   # Twilio Configuration
   TWILIO_ACCOUNT_SID=your-twilio-account-sid
   TWILIO_AUTH_TOKEN=your-twilio-auth-token
   TWILIO_COUNTRY_CODE=US

   # CORS Configuration
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
   ```

4. **Run migrations** (if needed)
   ```bash
   # Run customer user field migration
   node utils/customerUserMigration.js
   ```

5. **Start the server**
   ```bash
   npm start
   ```

## 📚 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "firstname": "John",
  "lastname": "Doe",
  "email": "john.doe@example.com",
  "phoneNumber": "+1234567890",
  "address": "123 Main St, City, State 12345",
  "password": "password123",
  "profession": "Developer",
  "professionDescription": "Full-stack web developer"
}
```

#### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "password": "password123"
}
```

#### Change Password
```http
PUT /api/auth/changepassword
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

#### Forgot Password
```http
POST /api/auth/forgotpassword
Content-Type: application/json

{
  "email": "john.doe@example.com"
}
```

#### Reset Password
```http
PUT /api/auth/resetpassword/:token
Content-Type: application/json

{
  "newPassword": "newpassword123"
}
```

### User Endpoints

#### Get User Profile
```http
GET /api/users/profile
Authorization: Bearer <jwt-token>
```

#### Get User by ID
```http
GET /api/users/:id
Authorization: Bearer <jwt-token>
```

#### Update User Profile
```http
PUT /api/users/:id
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "firstname": "John",
  "lastname": "Doe",
  "phoneNumber": "+1234567890",
  "address": "456 Oak Ave, City, State 67890",
  "profession": "Senior Developer",
  "professionDescription": "Full-stack web developer with 7 years experience"
}
```

#### Delete User (Soft Delete)
```http
DELETE /api/users/:id
Authorization: Bearer <jwt-token>
```

#### Get Customers by User ID
```http
GET /api/users/:id/customers
Authorization: Bearer <jwt-token>
```

### Task Endpoints

#### Get All Tasks (with pagination)
```http
GET /api/tasks?page=1&limit=10&search=project&sortBy=createdAt&sortOrder=desc
Authorization: Bearer <jwt-token>
```

#### Get Task by ID
```http
GET /api/tasks/:id
Authorization: Bearer <jwt-token>
```

#### Create Task
```http
POST /api/tasks
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "heading": "Complete Project Setup",
  "summary": "Set up the development environment and install dependencies",
  "description": "Install Node.js, MongoDB, and configure the development environment with all necessary tools and dependencies.",
  "isResolved": false,
  "customer": {
    "name": "Client Name",
    "address": "123 Client St, City, State 12345",
    "phoneNumber": "+1234567890"
  }
}
```

#### Update Task
```http
PUT /api/tasks/:id
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "heading": "Updated Task Heading",
  "summary": "Updated task summary",
  "description": "Updated task description",
  "isResolved": true,
  "customer": {
    "name": "Updated Client Name",
    "address": "456 Updated St, City, State 67890",
    "phoneNumber": "+1234567890"
  }
}
```

#### Delete Task (Soft Delete)
```http
DELETE /api/tasks/:id
Authorization: Bearer <jwt-token>
```

#### Get Deleted Tasks
```http
GET /api/tasks/deleted?page=1&limit=10
Authorization: Bearer <jwt-token>
```

#### Restore Deleted Task
```http
PUT /api/tasks/:id/restore
Authorization: Bearer <jwt-token>
```

### Customer Endpoints

#### Search Customers
```http
GET /api/customers?search=mar&page=1&limit=10
Authorization: Bearer <jwt-token>
```

#### Get Customer by ID
```http
GET /api/customers/:id
Authorization: Bearer <jwt-token>
```

#### Create Customer
```http
POST /api/customers
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "name": "Customer Name",
  "address": "123 Customer St, City, State 12345",
  "phoneNumber": "+1234567890"
}
```

#### Update Customer
```http
PUT /api/customers/:id
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "name": "Updated Customer Name",
  "address": "456 Updated St, City, State 67890",
  "phoneNumber": "+1234567890"
}
```

#### Delete Customer (Soft Delete)
```http
DELETE /api/customers/:id
Authorization: Bearer <jwt-token>
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 5000 |
| `MONGO_URI` | MongoDB connection string | Yes | - |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `EMAIL_HOST` | SMTP host for emails | Yes | - |
| `EMAIL_PORT` | SMTP port | Yes | - |
| `EMAIL_USER` | SMTP username | Yes | - |
| `EMAIL_PASS` | SMTP password | Yes | - |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | Yes | - |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | Yes | - |
| `TWILIO_COUNTRY_CODE` | Country code for phone numbers | No | US |
| `ALLOWED_ORIGINS` | CORS allowed origins | No | localhost:3000,3001 |

## 📁 Project Structure

```
Botie-Backend/
├── app.js                 # Main application file
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables
├── controllers/           # Route controllers
│   ├── authController.js  # Authentication logic
│   ├── userController.js  # User management
│   ├── taskController.js  # Task management
│   └── customerController.js # Customer management
├── models/                # Database models
│   ├── User.js           # User schema
│   ├── Task.js           # Task schema
│   └── Customer.js       # Customer schema
├── routes/                # API routes
│   ├── authRoutes.js     # Authentication routes
│   ├── userRoutes.js     # User routes
│   ├── taskRoutes.js     # Task routes
│   └── customerRoutes.js # Customer routes
├── middleware/            # Custom middleware
│   └── authMiddleware.js # JWT authentication
├── services/              # External services
│   ├── emailService.js   # Email functionality
│   └── twilioService.js  # Twilio integration
├── validators/            # Input validation
│   ├── authValidator.js  # Auth validation
│   └── taskValidator.js  # Task validation
├── templates/             # Email templates
│   ├── emailVerificationTemplate.html
│   ├── emailVerifiedSuccessTemplate.html
│   ├── emailVerifiedErrorTemplate.html
│   └── passwordResetTemplate.html
├── utils/                 # Utility functions
│   ├── migration.js      # Database migrations
│   ├── taskMigration.js  # Task-specific migrations
│   ├── taskIsResolvedMigration.js
│   └── customerUserMigration.js
└── tests/                 # Test files
    ├── softDelete.test.js
    └── taskUpdate.test.js
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Email Verification**: Required email verification for new accounts
- **Password Hashing**: Bcrypt password hashing
- **Input Validation**: Joi schema validation for all inputs
- **CORS Protection**: Configurable CORS settings
- **Soft Delete**: Data retention with soft delete functionality
- **User Isolation**: Users can only access their own data

## 🚀 Deployment

### Production Setup

1. **Set environment variables for production**
2. **Use a production MongoDB instance**
3. **Configure proper CORS origins**
4. **Set up SSL/TLS certificates**
5. **Use a process manager like PM2**

```bash
# Install PM2
npm install -g pm2

# Start the application
pm2 start app.js --name botie-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

## 🧪 Testing

Run the test suite:

```bash
npm test
```

## 📝 API Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": ["Detailed error messages"]
}
```

### Paginated Response
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 50,
      "hasNextPage": true,
      "hasPrevPage": false,
      "limit": 10
    }
  }
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions, please contact the development team or create an issue in the repository. 