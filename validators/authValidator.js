const Joi = require('joi');

const registerSchema = Joi.object({
    firstname: Joi.string().required(),
    lastname: Joi.string().required(),
    email: Joi.string().email().required(),
    phoneNumber: Joi.string().required(),
    address: Joi.string().optional().allow(''),
    password: Joi.string().min(6).required(),
    profession: Joi.string().optional().allow(''),
    professionDescription: Joi.string().optional().allow(''),
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
});

module.exports = {
    registerSchema,
    loginSchema,
}; 