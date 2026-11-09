import { body } from "express-validator";

const validator = [
    body("title")
        .isString().withMessage("Title must be text.")
        .bail()
        .trim()
        .notEmpty().withMessage("Title is required.")
        .isLength({ max: 150 }).withMessage("Title must be 150 characters or fewer."),
    body("description")
        .isString().withMessage("Description must be text.")
        .bail()
        .trim()
        .notEmpty().withMessage("Description is required."),
    body("developer")
        .isString().withMessage("Developer must be text.")
        .bail()
        .trim()
        .notEmpty().withMessage("Developer is required.")
        .isLength({ max: 150 }).withMessage("Developer must be 150 characters or fewer."),
    body("quantity")
        .isInt({ min: 0 }).withMessage("Quantity must be a non-negative whole number.")
        .toInt(),
    body("image_url")
        .isString().withMessage("Image URL must be text.")
        .bail()
        .trim()
        .optional({ values: "falsy" })
        .isURL({ protocols: ["http", "https"], require_protocol: true })
        .withMessage("Image URL must be a valid HTTP or HTTPS URL."),
    body("genre")
        .isString().withMessage("Genre must be text.")
        .bail()
        .trim()
        .notEmpty().withMessage("Genre is required.")
        .isLength({ max: 100 }).withMessage("Genre must be 100 characters or fewer."),
    body("genre_details")
        .isString().withMessage("Genre details must be text.")
        .bail()
        .trim()
        .notEmpty().withMessage("Genre details are required."),
    body("platform")
        .isString().withMessage("Platform must be text.")
        .bail()
        .trim()
        .notEmpty().withMessage("Platform is required.")
        .isLength({ max: 100 }).withMessage("Platform must be 100 characters or fewer.")
];

export default validator;