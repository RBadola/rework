import {Review} from "../models/base.admin.model.js";

// Create a review
export const createReview = async (req, res) => {
  try {
    const { product, rating, comment } = req.body;

    const review = new Review({
      user: req.user._id, // assumes user is added to req via auth middleware
      product,
      rating,
      comment,
    });

    await review.save();
    res.status(201).json({ success: true, review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all reviews for a product
export const getReviewsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const reviews = await Review.find({ product: productId }).populate("user", "name");

    res.json({ success: true, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update a review
export const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;

    const review = await Review.findById(reviewId);

    if (!review) return res.status(404).json({ message: "Review not found" });

    // Optional: Only allow user who created review to update
    if (!review.user.equals(req.user._id)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    review.rating = rating ?? review.rating;
    review.comment = comment ?? review.comment;

    await review.save();

    res.json({ success: true, review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete a review
export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);

    if (!review) return res.status(404).json({ message: "Review not found" });

    if (!review.user.equals(req.user._id)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await review.remove();

    res.json({ success: true, message: "Review deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
export const getAllReviews = async (req, res) => {
  try {
    const filter = {};
    if (req.query.product) {
      filter.product = req.query.product;
    }

    const reviews = await Review.find(filter).populate("user", "name").populate("product", "name");
    res.json({ success: true, count: reviews.length, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE single review by ID
export const deleteReviewById = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });

    await review.remove();
    res.json({ success: true, message: "Review deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE all reviews or by product
export const deleteAllReviews = async (req, res) => {
  try {
    const filter = {};
    if (req.query.product) {
      filter.product = req.query.product;
    }

    const result = await Review.deleteMany(filter);
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// CREATE a mock review
export const createMockReview = async (req, res) => {
  try {
    const { user, product, rating, comment } = req.body;

    if (!user || !product || !rating) {
      return res.status(400).json({ message: "user, product and rating are required" });
    }

    const review = await Review.create({
      user,
      product,
      rating,
      comment,
    });

    res.status(201).json({ success: true, review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE a mock review
export const updateMockReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const review = await Review.findById(req.params.id);

    if (!review) return res.status(404).json({ message: "Review not found" });

    review.rating = rating ?? review.rating;
    review.comment = comment ?? review.comment;

    await review.save();
    res.json({ success: true, review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};